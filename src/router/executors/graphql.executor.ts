import { GraphQLConnection, ToolDefinition } from '../../interfaces/types.js';
import { ToolError } from '../../utils/errors.js';
import { IToolExecutor } from '../router.interfaces.js';

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

export class GraphQLExecutor implements IToolExecutor {
  private config: GraphQLConnection;

  constructor(config: GraphQLConnection) {
    this.config = config;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (this.config.auth) {
      const token = process.env[this.config.auth.token_env];
      if (!token) {
        throw new ToolError(`Auth token env var "${this.config.auth.token_env}" is not set`);
      }

      if (this.config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        const header = this.config.auth.header ?? 'X-API-Key';
        headers[header] = token;
      }
    }

    return headers;
  }

  async execute(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown> {
    if (!tool.query) {
      throw new ToolError(`tool "${tool.name}": query is required for graphql connection type`);
    }

    const body = JSON.stringify({
      query: tool.query,
      variables: args,
    });

    let response: Response;

    try {
      response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body,
      });
    } catch (err) {
      throw new ToolError(
        `GraphQL request to "${this.config.endpoint}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new ToolError(
        `GraphQL request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const result = (await response.json()) as GraphQLResponse;

    if (result.errors && result.errors.length > 0) {
      const messages = result.errors.map((e) => e.message).join('; ');
      throw new ToolError(`GraphQL errors from tool "${tool.name}": ${messages}`);
    }

    return result.data ?? {};
  }
}
