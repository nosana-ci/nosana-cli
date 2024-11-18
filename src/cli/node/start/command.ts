import { Command, Option } from 'commander';

import { startNode } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';

export const startNodeCommand = new Command('start')
  .description('Start Nosana Node')
  .argument('[market]', 'market address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(walletOption)
  .addOption(
    new Option('--provider <provider>', 'provider used to run the job')
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(
    new Option(
    '--cuda <id>',
    'ID of the GPU to expose (e.g., 0, 1)'
   ).default('0')
  )
  .action(startNode);
