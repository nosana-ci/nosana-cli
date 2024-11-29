import { Command } from 'commander';

import { getMarkets } from './action.js';
import { networkOption } from '../../sharedOptions/index.js';

export const getMarketsCommand = new Command('list')
  .description('List available markets')
  .addOption(networkOption)
  .action(getMarkets);
