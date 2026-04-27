import { DatabaseConnection, ToolDefinition, ToolParam } from '../../interfaces/types.js';
import { ToolError } from '../../utils/errors.js';
import { IToolExecutor } from '../router.interfaces.js';

interface ConnectionDetails {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface NamedParamResult {
  sql: string;
  values: unknown[];
}

async function tryImport(pkg: string, installCmd: string): Promise<unknown> {
  try {
    return await import(pkg);
  } catch {
    throw new ToolError(`Package "${pkg}" is not installed. Run: npm install ${installCmd}`);
  }
}

export class DatabaseExecutor implements IToolExecutor {
  private config: DatabaseConnection;

  constructor(config: DatabaseConnection) {
    this.config = config;
  }

  private resolveConnectionDetails(): ConnectionDetails {
    const get = (envKey: string, field: string): string => {
      const value = process.env[envKey];
      if (!value) throw new ToolError(`Database env var "${envKey}" (${field}) is not set`);
      return value;
    };

    return {
      host: get(this.config.host_env, 'host'),
      port: parseInt(get(this.config.port_env, 'port'), 10),
      database: get(this.config.name_env, 'database name'),
      user: get(this.config.user_env, 'user'),
      password: get(this.config.password_env, 'password'),
    };
  }

  private resolveNamedParams(
    sql: string,
    args: Record<string, unknown>,
    params: ToolParam[],
    dialect: 'postgres' | 'mysql' | 'sqlite',
  ): NamedParamResult {
    const defaultsMap = new Map(params.map((p) => [p.name, p.default ?? null]));
    const values: unknown[] = [];
    let index = 0;

    const rewritten = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) => {
      const val = args[name] ?? defaultsMap.get(name) ?? null;
      values.push(val);
      index++;
      return dialect === 'postgres' ? `$${index}` : '?';
    });

    return { sql: rewritten, values };
  }

  async execute(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown> {
    if (!tool.query) {
      throw new ToolError(`tool "${tool.name}": query is required for database connection type`);
    }

    switch (this.config.driver) {
      case 'postgres':
        return this.executePostgres(tool.query, tool.params, args);
      case 'mysql':
        return this.executeMysql(tool.query, tool.params, args);
      case 'sqlite':
        return this.executeSqlite(tool.query, tool.params, args);
      default:
        throw new ToolError(`Unsupported database driver: "${this.config.driver}"`);
    }
  }

  private async executePostgres(query: string, params: ToolParam[], args: Record<string, unknown>): Promise<unknown> {
    const pgMod = await tryImport('pg', 'pg') as {
      default: { Pool: new (opts: unknown) => { query: (sql: string, vals: unknown[]) => Promise<{ rows: unknown[] }>; end: () => Promise<void> } };
    };

    const conn = this.resolveConnectionDetails();
    const pool = new pgMod.default.Pool({
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
      min: this.config.pool?.min ?? 2,
      max: this.config.pool?.max ?? 10,
    });

    try {
      const { sql, values } = this.resolveNamedParams(query, args, params, 'postgres');
      console.log('[liran] query:', sql);
      console.log('[liran] params:', values);
      const result = await pool.query(sql, values);
      console.log('[liran] rows returned:', result.rows.length);
      return result.rows;
    } catch (err) {
      throw new ToolError(
        `Postgres query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await pool.end();
    }
  }

  private async executeMysql(query: string, params: ToolParam[], args: Record<string, unknown>): Promise<unknown> {
    const mysqlMod = await tryImport('mysql2/promise', 'mysql2') as {
      default: {
        createConnection: (opts: unknown) => Promise<{
          execute: (sql: string, vals: unknown[]) => Promise<[unknown]>;
          end: () => Promise<void>;
        }>;
      };
    };

    const conn = this.resolveConnectionDetails();
    const connection = await mysqlMod.default.createConnection({
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
    });

    try {
      const { sql, values } = this.resolveNamedParams(query, args, params, 'mysql');
      console.log('[liran] query:', sql);
      console.log('[liran] params:', values);
      const [rows] = await connection.execute(sql, values);
      console.log('[liran] rows returned:', (rows as unknown[]).length);
      return rows;
    } catch (err) {
      throw new ToolError(
        `MySQL query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await connection.end();
    }
  }

  private async executeSqlite(query: string, params: ToolParam[], args: Record<string, unknown>): Promise<unknown> {
    const sqliteMod = await tryImport('better-sqlite3', 'better-sqlite3') as {
      default: new (path: string) => {
        prepare: (sql: string) => { all: (...vals: unknown[]) => unknown[] };
        close: () => void;
      };
    };

    const dbPath = process.env[this.config.name_env];
    if (!dbPath) {
      throw new ToolError(`SQLite db path env var "${this.config.name_env}" is not set`);
    }

    const db = new sqliteMod.default(dbPath);

    try {
      const { sql, values } = this.resolveNamedParams(query, args, params, 'sqlite');
      console.log('[liran] query:', sql);
      console.log('[liran] params:', values);
      const stmt = db.prepare(sql);
      const rows = stmt.all(...values);
      console.log('[liran] rows returned:', rows.length);
      return rows;
    } catch (err) {
      throw new ToolError(
        `SQLite query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      db.close();
    }
  }
}
