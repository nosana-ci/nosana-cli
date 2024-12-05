import { Command, Option } from 'commander';
import { networkOption, walletOption } from '../../sharedOptions/index.js';
import { migrateWalletCommand } from './action/index.js';
import { gpuOption } from '../../sharedOptions/--gpu.js';

export const migrateNodeCommand = new Command('migrate')
  .description(
    'Migrate your node to a new wallet, generating a new key before transferring all tokens',
  )
  .addOption(walletOption)
  .addOption(networkOption)
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
  .addOption(gpuOption)
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .action((opts) => migrateWalletCommand(opts));
