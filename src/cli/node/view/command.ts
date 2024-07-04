import { Command } from 'commander';

import { view } from './action.js';
import { networkOption, rpcOption } from '../../sharedOptions/index.js';

export const viewNodeCommand = new Command('view')
  .description('View Nosana Node')
  .argument('<node>', 'node address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .action(view);
