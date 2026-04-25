import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.liran-sdk');
const STATE_FILE = path.join(STATE_DIR, 'model-state.json');

export interface ModelState {
  activeModel: string;
  installedAt: string;
}

function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function readModelState(): ModelState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as ModelState;
  } catch {
    return null;
  }
}

export function writeModelState(modelName: string): void {
  ensureStateDir();
  const state: ModelState = { activeModel: modelName, installedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function detectModelSwitch(configuredModel: string): { switched: boolean; previous: string | null } {
  const state = readModelState();
  if (!state) return { switched: false, previous: null };
  const switched = state.activeModel !== configuredModel;
  return { switched, previous: switched ? state.activeModel : null };
}

export function getModelsDir(): string {
  return path.join(STATE_DIR, 'models');
}

export function listInstalledModels(): { name: string; file: string; sizeBytes: number }[] {
  const dir = getModelsDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.gguf'))
    .map((f) => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      return { name: f.replace('.gguf', ''), file: filePath, sizeBytes: stat.size };
    });
}

export function isModelInstalled(modelName: string): boolean {
  const file = path.join(getModelsDir(), `${modelName}.gguf`);
  return fs.existsSync(file);
}
