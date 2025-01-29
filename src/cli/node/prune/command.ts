import { Command, Option } from 'commander';
import { pruneResources } from './action.js';
import { portOption } from '../../sharedOptions/index.js';

export const nodePruneCommand = new Command('prune')
  .description('Safely prune none required images and resources.')
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
  .action(pruneResources);
