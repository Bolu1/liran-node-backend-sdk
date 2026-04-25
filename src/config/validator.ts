import {
  LiranConfig,
  ToolDefinition,
  ConnectionConfig,
  DatabaseConnection,
  RestConnection,
  GraphQLConnection,
} from '../interfaces/types.js';
import { ConfigurationError } from '../utils/errors.js';
import {
  VALID_MODEL_NAMES,
  VALID_CONNECTION_TYPES,
  VALID_DB_DIALECTS,
  VALID_PARAM_TYPES,
} from '../utils/constants.js';

const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const VALID_GRAPHQL_OPERATIONS = ['query', 'mutation'];
const VALID_AUTH_TYPES = ['bearer', 'api_key'];

export function validateConfig(config: LiranConfig): void {
  if (!config) {
    throw new ConfigurationError('Configuration is null or undefined');
  }

  validateSystemConfig(config);
  validateModelConfig(config);
  validateSessionConfig(config);
  validateConnectionConfig(config.connection);
  validatePermissionsConfig(config);
  validateToolsConfig(config);
}

function validateSystemConfig(config: LiranConfig): void {
  if (!config.system) {
    throw new ConfigurationError('system block is required');
  }

  if (
    !config.system.name ||
    typeof config.system.name !== 'string' ||
    config.system.name.trim().length === 0
  ) {
    throw new ConfigurationError('system.name is required and must be a non-empty string');
  }

  if (
    !config.system.domain ||
    typeof config.system.domain !== 'string' ||
    config.system.domain.trim().length === 0
  ) {
    throw new ConfigurationError('system.domain is required and must be a non-empty string');
  }

  if (config.system.language !== undefined && typeof config.system.language !== 'string') {
    throw new ConfigurationError('system.language must be a string');
  }
}

function validateModelConfig(config: LiranConfig): void {
  if (!config.model) return;

  if (!VALID_MODEL_NAMES.includes(config.model.name as (typeof VALID_MODEL_NAMES)[number])) {
    throw new ConfigurationError(
      `model.name must be one of: ${VALID_MODEL_NAMES.join(', ')}`,
    );
  }

  if (config.model.name === 'custom' && !config.model.path) {
    throw new ConfigurationError('model.path is required when model.name is "custom"');
  }

  if (config.model.path !== undefined && typeof config.model.path !== 'string') {
    throw new ConfigurationError('model.path must be a string');
  }

  if (
    config.model.context_window !== undefined &&
    (typeof config.model.context_window !== 'number' || config.model.context_window <= 0)
  ) {
    throw new ConfigurationError('model.context_window must be a positive number');
  }

  if (
    config.model.temperature !== undefined &&
    (typeof config.model.temperature !== 'number' ||
      config.model.temperature < 0 ||
      config.model.temperature > 2)
  ) {
    throw new ConfigurationError('model.temperature must be a number between 0 and 2');
  }
}

function validateSessionConfig(config: LiranConfig): void {
  if (!config.session) return;

  if (config.session.provider !== undefined && config.session.provider !== 'redis') {
    throw new ConfigurationError('session.provider must be "redis"');
  }

  if (
    config.session.ttl !== undefined &&
    (typeof config.session.ttl !== 'number' || config.session.ttl <= 0)
  ) {
    throw new ConfigurationError('session.ttl must be a positive number');
  }

  if (
    config.session.max_history !== undefined &&
    (typeof config.session.max_history !== 'number' || config.session.max_history <= 0)
  ) {
    throw new ConfigurationError('session.max_history must be a positive number');
  }
}

function validateConnectionConfig(connection: ConnectionConfig): void {
  if (!connection) {
    throw new ConfigurationError('connection block is required');
  }

  if (!VALID_CONNECTION_TYPES.includes(connection.type as (typeof VALID_CONNECTION_TYPES)[number])) {
    throw new ConfigurationError(
      `connection.type must be one of: ${VALID_CONNECTION_TYPES.join(', ')}`,
    );
  }

  switch (connection.type) {
    case 'rest_api':
      validateRestConnection(connection);
      break;
    case 'database':
      validateDatabaseConnection(connection);
      break;
    case 'graphql':
      validateGraphQLConnection(connection);
      break;
    case 'function':
      break;
  }
}

function validateRestConnection(conn: RestConnection): void {
  if (!conn.base_url || typeof conn.base_url !== 'string') {
    throw new ConfigurationError('connection.base_url is required for rest_api type');
  }

  if (conn.auth) {
    validateAuthConfig(conn.auth, 'connection.auth');
  }
}

function validateDatabaseConnection(conn: DatabaseConnection): void {
  if (!VALID_DB_DIALECTS.includes(conn.driver as (typeof VALID_DB_DIALECTS)[number])) {
    throw new ConfigurationError(
      `connection.driver must be one of: ${VALID_DB_DIALECTS.join(', ')}`,
    );
  }

  const requiredEnvFields = ['host_env', 'port_env', 'name_env', 'user_env', 'password_env'] as const;

  for (const field of requiredEnvFields) {
    if (!conn[field] || typeof conn[field] !== 'string') {
      throw new ConfigurationError(`connection.${field} is required for database type`);
    }
  }

  if (conn.pool !== undefined) {
    if (typeof conn.pool.min !== 'number' || conn.pool.min < 0) {
      throw new ConfigurationError('connection.pool.min must be a non-negative number');
    }
    if (typeof conn.pool.max !== 'number' || conn.pool.max < 1) {
      throw new ConfigurationError('connection.pool.max must be a positive number');
    }
    if (conn.pool.min > conn.pool.max) {
      throw new ConfigurationError('connection.pool.min must be less than or equal to pool.max');
    }
  }
}

function validateGraphQLConnection(conn: GraphQLConnection): void {
  if (!conn.endpoint || typeof conn.endpoint !== 'string') {
    throw new ConfigurationError('connection.endpoint is required for graphql type');
  }

  if (conn.auth) {
    validateAuthConfig(conn.auth, 'connection.auth');
  }
}

function validateAuthConfig(auth: { type: string; token_env: string; header?: string }, prefix: string): void {
  if (!VALID_AUTH_TYPES.includes(auth.type)) {
    throw new ConfigurationError(`${prefix}.type must be one of: ${VALID_AUTH_TYPES.join(', ')}`);
  }

  if (!auth.token_env || typeof auth.token_env !== 'string') {
    throw new ConfigurationError(`${prefix}.token_env is required`);
  }
}

function validatePermissionsConfig(config: LiranConfig): void {
  if (!config.permissions) {
    throw new ConfigurationError('permissions block is required');
  }

  if (!config.permissions.roles || typeof config.permissions.roles !== 'object') {
    throw new ConfigurationError('permissions.roles is required and must be an object');
  }

  for (const [role, definition] of Object.entries(config.permissions.roles)) {
    if (!definition.allowed_tools) {
      throw new ConfigurationError(`permissions.roles.${role}.allowed_tools is required`);
    }

    if (definition.allowed_tools !== '*' && !Array.isArray(definition.allowed_tools)) {
      throw new ConfigurationError(
        `permissions.roles.${role}.allowed_tools must be an array of strings or "*"`,
      );
    }
  }
}

function validateToolsConfig(config: LiranConfig): void {
  if (!config.tools || !Array.isArray(config.tools)) {
    throw new ConfigurationError('tools must be an array');
  }

  for (const tool of config.tools) {
    validateToolDefinition(tool, config.connection.type);
  }

  validateToolsReferencedInPermissions(config);
}

function validateToolDefinition(tool: ToolDefinition, connectionType: string): void {
  if (!tool.name || typeof tool.name !== 'string' || tool.name.trim().length === 0) {
    throw new ConfigurationError('Each tool must have a non-empty name');
  }

  if (
    !tool.description ||
    typeof tool.description !== 'string' ||
    tool.description.trim().length === 0
  ) {
    throw new ConfigurationError(`tool "${tool.name}": description is required`);
  }

  if (!Array.isArray(tool.params)) {
    throw new ConfigurationError(`tool "${tool.name}": params must be an array`);
  }

  for (const param of tool.params) {
    if (!param.name || typeof param.name !== 'string') {
      throw new ConfigurationError(`tool "${tool.name}": each param must have a name`);
    }

    if (!VALID_PARAM_TYPES.includes(param.type as (typeof VALID_PARAM_TYPES)[number])) {
      throw new ConfigurationError(
        `tool "${tool.name}", param "${param.name}": type must be one of ${VALID_PARAM_TYPES.join(', ')}`,
      );
    }

    if (typeof param.required !== 'boolean') {
      throw new ConfigurationError(
        `tool "${tool.name}", param "${param.name}": required must be a boolean`,
      );
    }
  }

  switch (connectionType) {
    case 'rest_api':
      validateRestTool(tool);
      break;
    case 'database':
      validateDatabaseTool(tool);
      break;
    case 'graphql':
      validateGraphQLTool(tool);
      break;
  }

  if (tool.confirm !== undefined && typeof tool.confirm !== 'boolean') {
    throw new ConfigurationError(`tool "${tool.name}": confirm must be a boolean`);
  }

  if (tool.expose?.fields !== undefined && !Array.isArray(tool.expose.fields)) {
    throw new ConfigurationError(`tool "${tool.name}": expose.fields must be an array`);
  }
}

function validateRestTool(tool: ToolDefinition): void {
  if (!tool.method || !VALID_HTTP_METHODS.includes(tool.method)) {
    throw new ConfigurationError(
      `tool "${tool.name}": method is required for rest_api and must be one of ${VALID_HTTP_METHODS.join(', ')}`,
    );
  }

  if (!tool.path || typeof tool.path !== 'string') {
    throw new ConfigurationError(`tool "${tool.name}": path is required for rest_api`);
  }
}

function validateDatabaseTool(tool: ToolDefinition): void {
  if (!tool.query || typeof tool.query !== 'string' || tool.query.trim().length === 0) {
    throw new ConfigurationError(`tool "${tool.name}": query is required for database connection type`);
  }
}

function validateGraphQLTool(tool: ToolDefinition): void {
  if (!tool.query || typeof tool.query !== 'string' || tool.query.trim().length === 0) {
    throw new ConfigurationError(`tool "${tool.name}": query is required for graphql connection type`);
  }

  if (tool.operation && !VALID_GRAPHQL_OPERATIONS.includes(tool.operation)) {
    throw new ConfigurationError(
      `tool "${tool.name}": operation must be one of ${VALID_GRAPHQL_OPERATIONS.join(', ')}`,
    );
  }
}

function validateToolsReferencedInPermissions(config: LiranConfig): void {
  const toolNames = new Set(config.tools.map((t) => t.name));

  for (const [role, definition] of Object.entries(config.permissions.roles)) {
    if (definition.allowed_tools === '*') continue;

    for (const toolName of definition.allowed_tools) {
      if (!toolNames.has(toolName)) {
        throw new ConfigurationError(
          `permissions.roles.${role}: references unknown tool "${toolName}"`,
        );
      }
    }
  }
}
