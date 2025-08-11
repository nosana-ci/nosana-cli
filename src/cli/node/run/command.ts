import { Argument, Command, Option } from 'commander';

import { runJob } from './action.js';
import { gpuOption } from '../../sharedOptions/--gpu.js';
import { verboseOption } from '../../sharedOptions/verbose.js';
import { walletOption } from '../../sharedOptions/wallet.js';

export const runNodeCommand = new Command('run')
  .description('Run Job Definition File')
  .addArgument(
    new Argument('<job-definition-file>', 'Job Definition File').argOptional(),
  )
  .addOption(
    new Option(
      '--provider <provider>',
      'provider used to run the job definition',
    )
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(new Option('--url <url>', 'Url path for the JSON flow'))
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('~/.nosana/podman/podman.sock'),
  )
  .addOption(walletOption)
  .addOption(gpuOption)
  .addOption(verboseOption)
  .action(runJob);
