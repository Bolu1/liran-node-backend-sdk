import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { LiranConfig } from '../interfaces/types.js';
import { ConfigurationError } from '../utils/errors.js';
import { DEFAULT_CONFIG, resolveModelCacheDir } from './defaults.js';
import { validateConfig } from './validator.js';

const CONFIG_FILE_NAME = 'liran.yaml';

export function loadConfig(configPath?: string): LiranConfig {
  const resolvedPath = configPath ? path.resolve(configPath) : findConfigFile();

  if (!resolvedPath) {
    throw new ConfigurationError(
      `No config file found. Create a ${CONFIG_FILE_NAME} in your project root.`,
    );
  }

  try {
    const raw = parseConfigFile(resolvedPath);

    if (!raw.system?.name) {
      throw new ConfigurationError(
        'Configuration file must include system.name. Example:\n' +
          'system:\n' +
          '  name: "My System"\n' +
          '  domain: "inventory management"',
      );
    }

    const merged = mergeConfigs(raw);
    const resolved = resolvePaths(merged);
    validateConfig(resolved);

    return resolved;
  } catch (err) {
    if (err instanceof ConfigurationError) throw err;
    throw new ConfigurationError(
      `Failed to load configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function configFileExists(configPath?: string): boolean {
  if (configPath) return fs.existsSync(path.resolve(configPath));
  return findConfigFile() !== null;
}

export function getConfigFilePath(configPath?: string): string | null {
  if (configPath) {
    const resolved = path.resolve(configPath);
    return fs.existsSync(resolved) ? resolved : null;
  }
  return findConfigFile();
}

function findConfigFile(): string | null {
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  return fs.existsSync(configPath) ? configPath : null;
}

function parseConfigFile(filePath: string): Partial<LiranConfig> {
  let content: string;

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new ConfigurationError(
      `Cannot read config file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;

  try {
    parsed = parse(content);
  } catch (err) {
    throw new ConfigurationError(
      `Invalid YAML syntax in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigurationError(`Config file ${filePath} is empty or not a valid YAML object`);
  }

  return parsed as Partial<LiranConfig>;
}

function mergeConfigs(user: Partial<LiranConfig>): LiranConfig {
  if (!user.connection) {
    throw new ConfigurationError('connection block is required');
  }

  return {
    system: {
      name: user.system?.name ?? DEFAULT_CONFIG.system?.name ?? '',
      domain: user.system?.domain ?? DEFAULT_CONFIG.system?.domain ?? '',
      language: user.system?.language ?? DEFAULT_CONFIG.system?.language ?? 'en',
    },
    model: {
      name: user.model?.name ?? DEFAULT_CONFIG.model?.name ?? 'qwen-0.5b',
      path: user.model?.path,
      cache_dir: user.model?.cache_dir ?? DEFAULT_CONFIG.model?.cache_dir ?? '~/.liran',
      context_window:
        user.model?.context_window ?? DEFAULT_CONFIG.model?.context_window ?? 4096,
      temperature: user.model?.temperature ?? DEFAULT_CONFIG.model?.temperature ?? 0.1,
    },
    session: {
      provider: user.session?.provider ?? DEFAULT_CONFIG.session?.provider ?? 'redis',
      ttl: user.session?.ttl ?? DEFAULT_CONFIG.session?.ttl ?? 1800,
      max_history: user.session?.max_history ?? DEFAULT_CONFIG.session?.max_history ?? 10,
      redis_url_env:
        user.session?.redis_url_env ?? DEFAULT_CONFIG.session?.redis_url_env ?? 'REDIS_URL',
    },
    connection: user.connection,
    permissions: {
      roles: user.permissions?.roles ?? {},
    },
    tools: user.tools ?? [],
  };
}

function resolvePaths(config: LiranConfig): LiranConfig {
  config.model.cache_dir = resolveModelCacheDir(config.model.cache_dir);

  if (config.model.path) {
    config.model.path = path.resolve(config.model.path);
  }

  return config;
}
