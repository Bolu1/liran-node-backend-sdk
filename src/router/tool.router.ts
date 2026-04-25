import {
  ConnectionConfig,
  ToolDefinition,
  DatabaseConnection,
  RestConnection,
  GraphQLConnection,
} from '../interfaces/types.js';
import { ToolHandler } from '../interfaces/liranSDK.interfaces.js';
import { ToolError, AuthorizationError } from '../utils/errors.js';
import { IToolExecutor } from './router.interfaces.js';
import { FunctionExecutor } from './executors/function.executor.js';
import { RestExecutor } from './executors/rest.executor.js';
import { DatabaseExecutor } from './executors/database.executor.js';
import { GraphQLExecutor } from './executors/graphql.executor.js';

export class ToolRouter {
  private executor: IToolExecutor;
  private tools: Map<string, ToolDefinition>;

  constructor(
    connection: ConnectionConfig,
    handlers: Map<string, ToolHandler>,
    tools: ToolDefinition[],
  ) {
    this.executor = this.createExecutor(connection, handlers);
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  private createExecutor(
    connection: ConnectionConfig,
    handlers: Map<string, ToolHandler>,
  ): IToolExecutor {
    switch (connection.type) {
      case 'function':
        return new FunctionExecutor(handlers);
      case 'rest_api':
        return new RestExecutor(connection as RestConnection);
      case 'database':
        return new DatabaseExecutor(connection as DatabaseConnection);
      case 'graphql':
        return new GraphQLExecutor(connection as GraphQLConnection);
      default:
        throw new ToolError(`Unknown connection type: "${(connection as ConnectionConfig).type}"`);
    }
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    allowedTools: string[] | '*',
  ): Promise<unknown> {
    if (allowedTools !== '*' && !allowedTools.includes(toolName)) {
      throw new AuthorizationError(
        `Role does not have permission to call tool "${toolName}"`,
      );
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolError(`Tool "${toolName}" is not defined in the config`);
    }

    const raw = await this.executor.execute(tool, args);

    return this.filterFields(raw, tool);
  }

  private filterFields(data: unknown, tool: ToolDefinition): unknown {
    if (!tool.expose?.fields || tool.expose.fields.length === 0) {
      return data;
    }

    const allowedFields = new Set(tool.expose.fields);

    if (Array.isArray(data)) {
      return data.map((item) => this.pickFields(item, allowedFields));
    }

    if (data && typeof data === 'object') {
      return this.pickFields(data as Record<string, unknown>, allowedFields);
    }

    return data;
  }

  private pickFields(
    obj: Record<string, unknown>,
    allowedFields: Set<string>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) => allowedFields.has(key)),
    );
  }
}
