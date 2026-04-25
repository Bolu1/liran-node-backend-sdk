import { ToolDefinition } from '../../interfaces/types.js';
import { ToolHandler } from '../../interfaces/liranSDK.interfaces.js';
import { ToolError } from '../../utils/errors.js';
import { IToolExecutor } from '../router.interfaces.js';

export class FunctionExecutor implements IToolExecutor {
  private handlers: Map<string, ToolHandler>;

  constructor(handlers: Map<string, ToolHandler>) {
    this.handlers = handlers;
  }

  async execute(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.handlers.get(tool.name);

    if (!handler) {
      throw new ToolError(
        `No handler registered for tool "${tool.name}". Call sdk.registerTool() before sdk.start().`,
      );
    }

    try {
      return await handler(args);
    } catch (err) {
      throw new ToolError(
        `Tool "${tool.name}" execution failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
