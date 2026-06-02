import { Command, Option } from 'commander';

import { listJobs } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';

export const listJobsCommand = new Command('list')
  .description('List jobs posted by the current wallet')
  .addOption(
    new Option(
      '--limit <number>',
      'maximum number of jobs to return (1-50)',
    ).argParser(Number),
  )
  .addOption(
    new Option(
      '--offset <number>',
      'number of jobs to skip for pagination',
    ).argParser(Number),
  )
  .addOption(
    new Option('--state <state>', 'filter by job state').choices([
      'QUEUED',
      'RUNNING',
      'COMPLETED',
      'STOPPED',
    ]),
  )
  .addOption(new Option('--market <market>', 'filter by market address'))
  .addOption(new Option('--node <node>', 'filter by node address'))
  .addOption(
    new Option(
      '--poster <poster>',
      'filter by poster address (defaults to current wallet)',
    ),
  )
  .addOption(new Option('--payer <payer>', 'filter by payer address'))
  .addOption(
    new Option(
      '--time-start <timestamp>',
      'filter jobs created after this Unix timestamp',
    ).argParser(Number),
  )
  .addOption(
    new Option(
      '--time-end <timestamp>',
      'filter jobs created before this Unix timestamp',
    ).argParser(Number),
  )
  .addOption(
    new Option('--group-by <field>', 'group results by field').choices([
      'project',
      'market',
    ]),
  )
  .addOption(
    new Option(
      '--time-series-interval <interval>',
      'time series grouping interval',
    ).choices(['day', 'week', 'month']),
  )
  .addOption(
    new Option('--use-multiplier', 'apply price multiplier to results'),
  )
  .addOption(new Option('--skip-cache', 'bypass cache and fetch fresh data'))
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .action(listJobs);
