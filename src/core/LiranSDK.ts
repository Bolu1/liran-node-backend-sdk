import { randomUUID } from 'crypto';
import { LiranConfig } from '../interfaces/types.js';
import {
  ILiranSDK,
  ToolHandler,
  ChatOptions,
  SDKStatus,
  QueryLog,
  LogQueryOptions,
} from '../interfaces/liranSDK.interfaces.js';
import { loadConfig } from '../config/loader.js';
import { ISessionStore, SessionMessage } from '../storage/session.interfaces.js';
import { RedisSessionStore } from '../storage/redis.session.js';
import { IModelLoader, ToolCallResult } from '../model/model.interfaces.js';
import { LlamaModelLoader } from '../model/llama.model.js';
import { ToolRouter } from '../router/tool.router.js';
import { resolveAllowedTools, getAllowedToolNames } from '../engine/auth.filter.js';
import { buildIntentPrompt, buildFormatPrompt } from '../engine/prompt.builder.js';
import { InitializationError } from '../utils/errors.js';


export class LiranSDK implements ILiranSDK {
  private config: LiranConfig;
  private session!: ISessionStore;
  private model!: IModelLoader;
  private router!: ToolRouter;
  private handlers: Map<string, ToolHandler> = new Map();
  private logs: QueryLog[] = [];
  private startedAt: number = Date.now();
  private initPromise: Promise<void>;

  constructor(configPath?: string) {
    this.config = loadConfig(configPath);
    this.initPromise = this.setup();
  }

  private async setup(): Promise<void> {
    const redisUrl = process.env[this.config.session.redis_url_env];

    if (!redisUrl) {
      throw new InitializationError(
        `Redis URL env var "${this.config.session.redis_url_env}" is not set`,
      );
    }

    try {
      this.session = new RedisSessionStore(redisUrl);
      await this.session.connect();
      console.log('[liran] Redis connected.');
    } catch (err) {
      console.error('[liran] Failed to connect to Redis:', err);
      throw err;
    }

    try {
      this.model = new LlamaModelLoader(this.config.model);
      await this.model.load();
      console.log('[liran] Model loaded.');
    } catch (err) {
      console.error('[liran] Failed to load model:', err);
      throw err;
    }

    this.router = new ToolRouter(this.config.connection, this.handlers, this.config.tools);
    this.startedAt = Date.now();
    console.log('[liran] Ready.');
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;

    if (this.config.connection.type === 'function') {
      const missing = this.config.tools
        .map((t) => t.name)
        .filter((name) => !this.handlers.has(name));

      if (missing.length > 0) {
        throw new InitializationError(
          `Missing handlers for tools: ${missing.join(', ')}. Call sdk.registerTool() for each before sdk.chat().`,
        );
      }
    }
  }

  registerTool(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  async start(): Promise<void> {
    await this.ensureReady();
  }

  private async resolveIntent(
    message: string,
    role: string,
    history: SessionMessage[],
  ): Promise<{ intentResult: ToolCallResult; allowedToolNames: string[] | '*' }> {
    const allowedTools = resolveAllowedTools(this.config, role);
    const allowedToolNames = getAllowedToolNames(this.config, role);
    const intentPrompt = buildIntentPrompt(this.config, allowedTools, history, message);

    const toolNames = allowedTools.map((t) => t.name);
    const toolParams = new Map(
      allowedTools.map((t) => [
        t.name,
        t.params.map((p) => ({ name: p.name, type: p.type as 'string' | 'number' | 'boolean', required: p.required })),
      ]),
    );

    const intentResult = await this.model.parseIntent(intentPrompt, message, toolNames, toolParams);
    return { intentResult, allowedToolNames };
  }

  private async persistTurn(
    sessionId: string,
    userId: string,
    role: string,
    message: string,
    response: string,
    intentResult: ToolCallResult,
    startTime: number,
    rawToolData?: unknown,
  ): Promise<void> {
    const { ttl } = this.config.session;
    const now = Date.now();

    await this.session.appendMessage(
      sessionId, userId, role,
      { role: 'user', content: message, timestamp: now },
      ttl,
    );

    if (rawToolData !== undefined && intentResult.tool !== '__none__') {
      await this.session.appendMessage(
        sessionId, userId, role,
        { role: 'tool_result', content: JSON.stringify(rawToolData), timestamp: now, toolName: intentResult.tool },
        ttl,
      );
    }

    await this.session.appendMessage(
      sessionId, userId, role,
      { role: 'assistant', content: response, timestamp: now },
      ttl,
    );

    this.logs.push({
      id: randomUUID(),
      userId,
      role,
      sessionId,
      message,
      toolCalled: intentResult.tool === '__none__' ? undefined : intentResult.tool,
      toolArgs: intentResult.tool === '__none__' ? undefined : intentResult.args,
      response,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    });
  }

  async chat(options: ChatOptions): Promise<string> {
    await this.ensureReady();

    const { message, sessionId, userId, role } = options;
    const startTime = Date.now();

    try {
      const history = await this.session.getHistory(sessionId, this.config.session.max_history);
      const { intentResult, allowedToolNames } = await this.resolveIntent(message, role, history);

      let response: string;
      let rawData: unknown;

      if (intentResult.tool === '__none__') {
        response = intentResult.message ?? "I'm not sure how to help with that.";
      } else {
        rawData = await this.router.execute(intentResult.tool, intentResult.args, allowedToolNames);
        const formatPrompt = buildFormatPrompt(this.config, intentResult.tool, rawData, message, history);
        response = await this.model.formatResponse(formatPrompt, rawData);
      }

      await this.persistTurn(sessionId, userId, role, message, response, intentResult, startTime, rawData);
      return response;
    } catch (err) {
      console.error('[liran] chat() error:', err);
      throw err;
    }
  }

  async *chatStream(options: ChatOptions): AsyncIterable<string> {
    await this.ensureReady();

    const { message, sessionId, userId, role } = options;
    const startTime = Date.now();

    let history: SessionMessage[];
    try {
      history = await this.session.getHistory(sessionId, this.config.session.max_history);
    } catch (err) {
      console.error('[liran] chatStream() failed to fetch history:', err);
      throw err;
    }

    let intentResult: ToolCallResult;
    let allowedToolNames: string[] | '*';

    try {
      ({ intentResult, allowedToolNames } = await this.resolveIntent(message, role, history));
    } catch (err) {
      console.error('[liran] chatStream() intent resolution failed:', err);
      throw err;
    }

    if (intentResult.tool === '__none__') {
      const response = intentResult.message ?? "I'm not sure how to help with that.";
      yield response;
      await this.persistTurn(sessionId, userId, role, message, response, intentResult, startTime);
      return;
    }

    const rawData = await this.router.execute(intentResult.tool, intentResult.args, allowedToolNames);
    const formatPrompt = buildFormatPrompt(this.config, intentResult.tool, rawData, message, history);

    // Bridge: node-llama-cpp uses sync callbacks — convert to AsyncIterable via queue
    const queue: string[] = [];
    let streamDone = false;
    let notify: (() => void) | null = null;

    const modelPromise = this.model
      .formatResponseStream(formatPrompt, rawData, (token) => {
        queue.push(token);
        if (notify) { const fn = notify; notify = null; fn(); }
      })
      .then(() => {
        streamDone = true;
        if (notify) { const fn = notify; notify = null; fn(); }
      });

    const accumulated: string[] = [];

    while (!streamDone || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((r) => { notify = r; });
      }

      while (queue.length > 0) {
        const token = queue.shift()!;
        accumulated.push(token);
        yield token;
      }
    }

    await modelPromise;

    await this.persistTurn(
      sessionId, userId, role, message,
      accumulated.join(''),
      intentResult,
      startTime,
      rawData,
    );
  }

  async getStatus(): Promise<SDKStatus> {
    await this.initPromise;

    return {
      modelLoaded: this.model.isLoaded(),
      activeSessions: await this.session.getActiveSessionCount(),
      uptime: Date.now() - this.startedAt,
      configName: this.config.system.name,
    };
  }

  async getLogs(options?: LogQueryOptions): Promise<QueryLog[]> {
    let results = [...this.logs];

    if (options?.userId) results = results.filter((l) => l.userId === options.userId);
    if (options?.toolName) results = results.filter((l) => l.toolCalled === options.toolName);
    if (options?.from) results = results.filter((l) => l.timestamp >= options.from!);
    if (options?.to) results = results.filter((l) => l.timestamp <= options.to!);
    if (options?.limit) results = results.slice(-options.limit);

    return results;
  }

  getConfig(): LiranConfig {
    return this.config;
  }
}
