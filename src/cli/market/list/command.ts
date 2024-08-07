import { Command, Option } from 'commander';

import { getMarkets } from './action.js';

export const getMarketsCommand = new Command('list')
  .description('List available markets')
  .action(getMarkets);
