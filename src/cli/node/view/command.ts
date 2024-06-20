import { Command } from 'commander';

import { view } from './action';
import { networkOption, rpcOption } from '../../sharedOptions';

export const viewNodeCommand = new Command('view')
  .command('view')
  .argument('<node>', 'node address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .description('View Nosana Node')
  .action(view);
