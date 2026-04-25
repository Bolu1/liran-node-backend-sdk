import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readModelState } from '../../model/model.state.js';
import { VALID_MODEL_NAMES, MODEL_URIS } from '../../utils/constants.js';

const MODELS_DIR = path.join(os.homedir(), '.liran-sdk', 'models');

export function models(): void {
  const state = readModelState();
  const active = state?.activeModel ?? null;

  console.log('Available models:\n');

  for (const name of VALID_MODEL_NAMES) {
    if (name === 'custom') continue;

    const uri = MODEL_URIS[name];
    const fileName = uri.split('/').pop()!;
    const installed = fs.existsSync(path.join(MODELS_DIR, fileName));
    const isActive = name === active;

    const tag = isActive ? ' ✓ (active)' : installed ? ' (installed)' : '';
    console.log(`  ${name}${tag}`);
    console.log(`    ${uri}\n`);
  }

  if (!active) {
    console.log('No active model. Run: liran install');
  } else {
    console.log(`Active: ${active}`);
    if (state?.installedAt) console.log(`Since:  ${state.installedAt}`);
  }
}
