import { Command, Option } from 'commander';

import { getURL } from './action.js';
import { networkOption, rpcOption } from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

export const getURLCommand = new Command('url')
  .description('Get a job secret exposed url')
  .argument('<job>', 'job address')
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(getURL);