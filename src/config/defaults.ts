import * as path from 'path';
import * as os from 'os';
import { LiranConfig } from '../interfaces/types.js';
import {
  DEFAULT_CACHE_DIR,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL_NAME,
  DEFAULT_REDIS_URL_ENV,
  DEFAULT_SESSION_MAX_HISTORY,
  DEFAULT_SESSION_PROVIDER,
  DEFAULT_SESSION_TTL,
  DEFAULT_TEMPERATURE,
} from '../utils/constants.js';

export function resolveModelCacheDir(cacheDir: string): string {
  if (cacheDir.startsWith('~/')) {
    return path.resolve(cacheDir.replace('~', os.homedir()));
  }
  if (cacheDir === DEFAULT_CACHE_DIR) {
    return path.join(os.homedir(), '.liran-sdk');
  }
  return path.resolve(cacheDir);
}

export const DEFAULT_CONFIG: Partial<LiranConfig> = {
  system: {
    name: '',
    domain: '',
    language: DEFAULT_LANGUAGE,
  },
  model: {
    name: DEFAULT_MODEL_NAME,
    cache_dir: DEFAULT_CACHE_DIR,
    context_window: DEFAULT_CONTEXT_WINDOW,
    temperature: DEFAULT_TEMPERATURE,
  },
  session: {
    provider: DEFAULT_SESSION_PROVIDER,
    ttl: DEFAULT_SESSION_TTL,
    max_history: DEFAULT_SESSION_MAX_HISTORY,
    redis_url_env: DEFAULT_REDIS_URL_ENV,
  },
  tools: [],
};
