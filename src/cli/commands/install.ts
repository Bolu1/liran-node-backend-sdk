import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createModelDownloader } from 'node-llama-cpp';
import { loadConfig } from '../../config/loader.js';
import { MODEL_URIS } from '../../utils/constants.js';
import { writeModelState } from '../../model/model.state.js';

const MODELS_DIR = path.join(os.homedir(), '.liran-sdk', 'models');

export async function install(configPath?: string): Promise<void> {
  const config = loadConfig(configPath);
  const modelName = config.model.name;

  if (modelName === 'custom') {
    console.log('Custom model configured — nothing to download.');
    return;
  }

  const uri = MODEL_URIS[modelName];
  if (!uri) {
    console.error(`Unknown model "${modelName}". Check your liran.yaml.`);
    process.exit(1);
  }

  const fileName = uri.split('/').pop()!;
  const destFile = path.join(MODELS_DIR, fileName);

  if (fs.existsSync(destFile)) {
    console.log(`Model "${modelName}" already installed at ${destFile}`);
    writeModelState(modelName);
    return;
  }

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`Installing model "${modelName}"...`);
  console.log(`Source: ${uri}`);
  console.log(`Dest:   ${MODELS_DIR}`);

  try {
    const downloader = await createModelDownloader({
      modelUri: uri,
      dirPath: MODELS_DIR,
    });

    await downloader.download();
    writeModelState(modelName);
    console.log(`Model "${modelName}" installed successfully.`);
  } catch (err) {
    console.error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
