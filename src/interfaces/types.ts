import {
  VALID_MODEL_NAMES,
  VALID_CONNECTION_TYPES,
  VALID_DB_DIALECTS,
  VALID_PARAM_TYPES,
} from '../utils/constants.js';

export type ModelName = (typeof VALID_MODEL_NAMES)[number];
export type ConnectionType = (typeof VALID_CONNECTION_TYPES)[number];
export type DatabaseDialect = (typeof VALID_DB_DIALECTS)[number];
export type ParamType = (typeof VALID_PARAM_TYPES)[number];
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type GraphQLOperation = 'query' | 'mutation';
export type AuthType = 'bearer' | 'api_key';

export interface ToolParam {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  params: ToolParam[];
  // REST
  method?: HttpMethod;
  path?: string;
  // Database
  query?: string;
  // GraphQL
  operation?: GraphQLOperation;
  // Common
  expose?: { fields: string[] };
  confirm?: boolean;
}

export interface SystemConfig {
  name: string;
  domain: string;
  language: string;
}

export interface ModelConfig {
  name: ModelName;
  path?: string;
  cache_dir: string;
  context_window: number;
  temperature: number;
}

export interface SessionConfig {
  provider: 'redis';
  ttl: number;
  max_history: number;
  redis_url_env: string;
}

export interface AuthConfig {
  type: AuthType;
  token_env: string;
  header?: string;
}

export interface FunctionConnection {
  type: 'function';
}

export interface RestConnection {
  type: 'rest_api';
  base_url: string;
  auth?: AuthConfig;
}

export interface DatabaseConnection {
  type: 'database';
  driver: DatabaseDialect;
  host_env: string;
  port_env: string;
  name_env: string;
  user_env: string;
  password_env: string;
  pool?: {
    min: number;
    max: number;
  };
}

export interface GraphQLConnection {
  type: 'graphql';
  endpoint: string;
  auth?: AuthConfig;
}

export type ConnectionConfig =
  | FunctionConnection
  | RestConnection
  | DatabaseConnection
  | GraphQLConnection;

export interface PermissionsConfig {
  roles: Record<string, { allowed_tools: string[] | '*' }>;
}

export interface LiranConfig {
  system: SystemConfig;
  model: ModelConfig;
  session: SessionConfig;
  connection: ConnectionConfig;
  permissions: PermissionsConfig;
  tools: ToolDefinition[];
}
