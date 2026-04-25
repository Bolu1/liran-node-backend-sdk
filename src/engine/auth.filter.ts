import { LiranConfig, ToolDefinition } from '../interfaces/types.js';
import { AuthorizationError } from '../utils/errors.js';

export function resolveAllowedTools(
  config: LiranConfig,
  role: string,
): ToolDefinition[] {
  const roleConfig = config.permissions.roles[role];

  if (!roleConfig) {
    throw new AuthorizationError(
      `Role "${role}" is not defined in permissions. Defined roles: ${Object.keys(config.permissions.roles).join(', ')}`,
    );
  }

  if (roleConfig.allowed_tools === '*') {
    return config.tools;
  }

  const allowedSet = new Set(roleConfig.allowed_tools);
  return config.tools.filter((tool) => allowedSet.has(tool.name));
}

export function getAllowedToolNames(config: LiranConfig, role: string): string[] | '*' {
  const roleConfig = config.permissions.roles[role];

  if (!roleConfig) {
    throw new AuthorizationError(`Role "${role}" is not defined in permissions`);
  }

  return roleConfig.allowed_tools;
}
