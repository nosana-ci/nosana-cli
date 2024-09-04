import { Command, Option } from 'commander';

import { jobServe } from './action.js';
import { networkOption } from '../../sharedOptions/network.js';
import { walletOption } from '../../sharedOptions/wallet.js';

export const jobServeCommand = new Command('serve')
  .description('Create nosana job listening server')
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(
    new Option('-p, --port <port>', 'Set the listening port').default('3000'),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .action(jobServe);
