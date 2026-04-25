import { ToolDefinition } from '../interfaces/types.js';

export interface IToolExecutor {
  execute(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown>;
}
