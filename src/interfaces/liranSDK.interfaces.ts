import { LiranConfig } from './types.js';

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ChatOptions {
  message: string;
  sessionId: string;
  userId: string;
  role: string;
}

export interface SDKStatus {
  modelLoaded: boolean;
  activeSessions: number;
  uptime: number;
  configName: string;
}

export interface QueryLog {
  id: string;
  userId: string;
  role: string;
  sessionId: string;
  message: string;
  toolCalled?: string;
  toolArgs?: Record<string, unknown>;
  response: string;
  timestamp: Date;
  durationMs: number;
}

export interface LogQueryOptions {
  userId?: string;
  toolName?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface ILiranSDK {
  registerTool(name: string, handler: ToolHandler): void;
  start(): Promise<void>;
  chat(options: ChatOptions): Promise<string>;
  chatStream(options: ChatOptions): AsyncIterable<string>;
  getStatus(): Promise<SDKStatus>;
  getLogs(options?: LogQueryOptions): Promise<QueryLog[]>;
  getConfig(): LiranConfig;
}
