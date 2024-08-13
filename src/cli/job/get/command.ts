import { Command, Option } from 'commander';

import { getJob } from './action.js';
import { networkOption, rpcOption } from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

export const getJobCommand = new Command('get')
  .description('Get a job and display result')
  .argument('<job>', 'job address')
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path (implies --wait)',
    ),
  )
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(getJob);
