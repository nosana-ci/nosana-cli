import { Command, Option } from 'commander';

import { runBenchmark } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';

export const joinTestGridCommand = new Command('join-test-grid')
  .description('Join Test Grid Devnet Job')
  .addOption(
    new Option(
      '--provider <provider>',
      'provider used to run the job definition',
    )
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .addOption(walletOption)
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(new Option('--no-airdrop', 'no airdrop on devnet'))
  .action(runBenchmark);
