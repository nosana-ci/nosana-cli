import { Argument, Command, Option } from 'commander';

import { runJob } from './action.js';
import { gpuOption } from '../../sharedOptions/index.js';

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
    ).default('http://localhost:8080'),
  )
  .addOption(gpuOption)
  .action(runJob);
