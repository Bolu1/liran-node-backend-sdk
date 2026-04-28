#!/usr/bin/env node

import { install } from './commands/install.js';
import { models } from './commands/models.js';

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'install':
      await install(args[0]);
      break;

    case 'models':
      models();
      break;

    default:
      console.log('liran-backend-sdk CLI\n');
      console.log('Commands:');
      console.log('  liran install [config]   Download the model specified in liran.yaml');
      console.log('  liran models             List available models and active selection');
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
