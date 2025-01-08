import { Command, Option } from 'commander';

import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';
import { extendJob } from './action.js';

export const extendJobCommand = new Command('extend')
  .description('extend a job timeout')
  .argument('<job>', 'job address')
  .addOption(
    new Option(
      '-t, --timeout <timeout>',
      'the duration you want to add to the job (in minutes)',
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
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(extendJob);
