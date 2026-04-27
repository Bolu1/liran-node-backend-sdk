export const VALID_MODEL_NAMES = [
  'qwen-0.5b',
  'smollm3-3b',
  'phi-4-mini',
  'qwen2.5-7b',
  'custom',
] as const;

export const VALID_CONNECTION_TYPES = ['function', 'rest_api', 'database', 'graphql'] as const;

export const VALID_DB_DIALECTS = ['postgres', 'mysql', 'sqlite'] as const;

export const VALID_PARAM_TYPES = ['string', 'number', 'boolean'] as const;

export const DEFAULT_MODEL_NAME = 'qwen-0.5b' as const;
export const DEFAULT_CACHE_DIR = '~/.liran-sdk';
export const DEFAULT_CONTEXT_WINDOW = 4096;
export const DEFAULT_TEMPERATURE = 0.1;
export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_SESSION_PROVIDER = 'redis' as const;
export const DEFAULT_SESSION_TTL = 1800;
export const DEFAULT_SESSION_MAX_HISTORY = 10;
export const DEFAULT_REDIS_URL_ENV = 'REDIS_URL';

export const MODEL_URIS: Record<string, string> = {
  // Repo: Qwen/Qwen2.5-0.5B-Instruct-GGUF | File: qwen2.5-0.5b-instruct-q4_k_m.gguf
  'qwen-0.5b': 'hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q4_k_m.gguf',

  // Repo: bartowski/HuggingFaceTB_SmolLM3-3B-GGUF | File: HuggingFaceTB_SmolLM3-3B-Q4_K_M.gguf
  'smollm3-3b': 'hf:bartowski/HuggingFaceTB_SmolLM3-3B-GGUF/HuggingFaceTB_SmolLM3-3B-Q4_K_M.gguf',

  // Repo: bartowski/microsoft_Phi-4-mini-instruct-GGUF | File: microsoft_Phi-4-mini-instruct-Q4_K_M.gguf
  'phi-4-mini':
    'hf:bartowski/microsoft_Phi-4-mini-instruct-GGUF/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf',

  // Repo: bartowski/Qwen2.5-7B-Instruct-1M-GGUF | File: Qwen2.5-7B-Instruct-1M-Q4_K_M.gguf
  'qwen2.5-7b': 'hf:bartowski/Qwen2.5-7B-Instruct-1M-GGUF/Qwen2.5-7B-Instruct-1M-Q4_K_M.gguf',
};
