import { Command, Option } from 'commander';

import { getJob } from '../../actions/job';
import { networkOption, rpcOption } from '../sharedOptions';

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
  .action(getJob);
