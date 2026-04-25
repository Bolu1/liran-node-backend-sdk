import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getLlama,
  createModelDownloader,
  Llama,
  LlamaModel,
  LlamaChatSession,
} from 'node-llama-cpp';
import { ModelConfig } from '../interfaces/types.js';
import { ModelError } from '../utils/errors.js';
import { MODEL_URIS } from '../utils/constants.js';
import { IModelLoader, ToolCallResult } from './model.interfaces.js';
import { detectModelSwitch, writeModelState } from './model.state.js';

const MODELS_DIR = path.join(os.homedir(), '.liran-sdk', 'models');

const TOOL_CALL_SCHEMA = {
  type: 'object' as const,
  properties: {
    tool: { type: 'string' as const },
    args: { type: 'object' as const },
  },
  required: ['tool', 'args'],
};

export class LlamaModelLoader implements IModelLoader {
  private config: ModelConfig;
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(config: ModelConfig) {
    this.config = config;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    return prev.then(() => fn()).finally(() => release());
  }

  private async resolveOrDownloadModel(): Promise<string> {
    if (this.config.name === 'custom') {
      if (!this.config.path) {
        throw new ModelError('model.path is required when model.name is "custom"');
      }
      return this.config.path;
    }

    const uri = MODEL_URIS[this.config.name];
    if (!uri) {
      throw new ModelError(`No URI found for model: ${this.config.name}`);
    }

    fs.mkdirSync(MODELS_DIR, { recursive: true });

    const downloader = await createModelDownloader({
      modelUri: uri,
      dirPath: MODELS_DIR,
    });

    if (fs.existsSync(downloader.entrypointFilePath)) {
      return downloader.entrypointFilePath;
    }

    console.log(`[liran] Downloading model "${this.config.name}"...`);
    const modelPath = await downloader.download();
    console.log(`[liran] Model "${this.config.name}" downloaded successfully.`);
    return modelPath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    const { switched, previous } = detectModelSwitch(this.config.name);
    if (switched) {
      console.warn(
        `[liran] Model switched from "${previous}" to "${this.config.name}".`,
      );
    }

    try {
      const modelPath = await this.resolveOrDownloadModel();

      this.llama = await getLlama();
      this.model = await this.llama.loadModel({ modelPath });

      writeModelState(this.config.name);
      this.loaded = true;
    } catch (err) {
      throw new ModelError(
        `Failed to load model "${this.config.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  private async withSession<T>(fn: (session: LlamaChatSession) => Promise<T>): Promise<T> {
    if (!this.model) {
      throw new ModelError('Model not loaded. Call load() first.');
    }

    const context = await this.model.createContext({
      contextSize: this.config.context_window,
    });

    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    try {
      return await fn(session);
    } finally {
      session.dispose();
      await context.dispose();
    }
  }

  async parseIntent(systemPrompt: string, userMessage: string): Promise<ToolCallResult> {
    return this.enqueue(async () => {
      if (!this.llama) {
        throw new ModelError('Model not loaded. Call load() first.');
      }

      return this.withSession(async (session) => {
        const grammar = await this.llama!.createGrammarForJsonSchema(TOOL_CALL_SCHEMA);

        try {
          const raw = await session.prompt(`${systemPrompt}\n\n${userMessage}`, {
            grammar,
            temperature: this.config.temperature,
          });
          return JSON.parse(raw) as ToolCallResult;
        } catch (err) {
          throw new ModelError(
            `Intent parsing failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
    });
  }

  async formatResponse(systemPrompt: string, rawData: unknown): Promise<string> {
    return this.enqueue(() =>
      this.withSession(async (session) => {
        const prompt = `${systemPrompt}\n\nData: ${JSON.stringify(rawData)}\n\nRespond in natural language.`;
        try {
          return await session.prompt(prompt, { temperature: this.config.temperature });
        } catch (err) {
          throw new ModelError(
            `Response formatting failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }

  async formatResponseStream(
    systemPrompt: string,
    rawData: unknown,
    onToken: (token: string) => void,
  ): Promise<void> {
    return this.enqueue(() =>
      this.withSession(async (session) => {
        const prompt = `${systemPrompt}\n\nData: ${JSON.stringify(rawData)}\n\nRespond in natural language.`;
        try {
          await session.prompt(prompt, {
            temperature: this.config.temperature,
            onTextChunk: onToken,
          });
        } catch (err) {
          throw new ModelError(
            `Response stream failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }
}
