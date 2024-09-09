import { Command, Option } from 'commander';

import { networkOption, rpcOption, walletOption } from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';
import { stopJob } from "./action.js";

export const stopJobCommand = new Command('stop')
  .description('stop a job')
  .argument('<job>', 'job address')
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(stopJob);
