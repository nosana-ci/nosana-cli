import { Command, Option } from 'commander';

import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';
import { extendJob } from './action.js';
import { timeoutOption } from '../../sharedOptions/timeout.js';

export const extendJobCommand = new Command('extend')
  .description('extend a job timeout')
  .argument('<job>', 'job address')
  .addOption(timeoutOption)
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(extendJob);
