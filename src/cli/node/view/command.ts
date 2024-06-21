import { Command } from 'commander';

import { view } from './action';
import { networkOption, rpcOption } from '../../sharedOptions';

export const viewNodeCommand = new Command('view')
  .description('View Nosana Node')
  .argument('<node>', 'node address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .action(view);
