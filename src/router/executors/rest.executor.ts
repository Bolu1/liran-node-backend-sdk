import { RestConnection, ToolDefinition } from '../../interfaces/types.js';
import { ToolError } from '../../utils/errors.js';
import { IToolExecutor } from '../router.interfaces.js';

export class RestExecutor implements IToolExecutor {
  private config: RestConnection;

  constructor(config: RestConnection) {
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

  private buildUrl(templatePath: string, args: Record<string, unknown>): string {
    const base = this.config.base_url.replace(/\/$/, '');

    const resolvedPath = templatePath.replace(/\{(\w+)\}/g, (_, key) => {
      const value = args[key];
      if (value === undefined) {
        throw new ToolError(`Path parameter "{${key}}" is missing from args`);
      }
      return encodeURIComponent(String(value));
    });

    return `${base}${resolvedPath}`;
  }

  async execute(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown> {
    if (!tool.method) {
      throw new ToolError(`tool "${tool.name}": method is required for rest_api`);
    }

    if (!tool.path) {
      throw new ToolError(`tool "${tool.name}": path is required for rest_api`);
    }

    const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(tool.method);

    // Extract path param names so they are not duplicated in the query string
    const pathParamNames = new Set([...tool.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

    const url = this.buildUrl(tool.path, args);

    const queryArgs = Object.fromEntries(
      Object.entries(args).filter(([k]) => !pathParamNames.has(k))
    );

    const finalUrl =
      !isBodyMethod && Object.keys(queryArgs).length > 0
        ? `${url}?${new URLSearchParams(queryArgs as Record<string, string>).toString()}`
        : url;

    try {
      const response = await fetch(finalUrl, {
        method: tool.method,
        headers: this.buildHeaders(),
        ...(isBodyMethod && { body: JSON.stringify(queryArgs) }),
      });

      if (!response.ok) {
        throw new ToolError(
          `[${tool.method} ${finalUrl}] failed with status ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof ToolError) throw err;
      throw new ToolError(
        `REST call to tool "${tool.name}" failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
