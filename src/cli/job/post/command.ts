import { Command, Option } from 'commander';

import { run } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

export const postJobCommand = new Command('post')
  .description('Create a job to run by Nosana Runners')
  .argument('[command...]', 'command to run')
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(new Option('--no-airdrop', 'no airdrop on devnet'))
  .addOption(new Option('--gpu', 'enable GPU on node'))
  .addOption(
    new Option(
      '-o, --output <path>',
      'specify which folder inside the container you want to upload',
    ),
  )
  .addOption(
    new Option(
      '-m, --market <market>',
      'market slug or address',
    ).makeOptionMandatory(true),
  )
  .addOption(walletOption)
  .addOption(
    new Option('--type <type>', 'type to run')
      .choices(['container'])
      .default('container'),
  )
  .addOption(
    new Option('-i, --image <image>', 'docker image to use').default('ubuntu'),
  )
  .addOption(new Option('-f, --file <path>', 'file with the JSON flow'))
  .addOption(
    new Option('--url <url>', 'Url path for the JSON flow').conflicts('file'),
  )
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path  (implies --wait)',
    ).conflicts('file'),
  )
  .addOption(
    new Option(
      '-t, --timeout <timeout>',
      'the duration the job should run for (in minutes)',
    )
      .makeOptionMandatory(true)
      .argParser((value) => {
        const timeout = parseInt(value, 10);
        if (isNaN(timeout) || timeout <= 0) {
          throw new Error(
            'Invalid timeout value. Please provide a positive integer.',
          );
        }

        // Convert minutes to seconds
        const timeoutInSeconds = timeout * 60;

        return timeoutInSeconds;
      }),
  )
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(run);
