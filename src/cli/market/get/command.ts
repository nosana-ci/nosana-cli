import { Command, Option } from 'commander';

import { getMarket } from './action.js';
import { networkOption } from '../../sharedOptions/index.js';

export const getMarketCommand = new Command('get')
  .description('Get a market')
  .addOption(networkOption)
  .argument('<market>', 'market address/slug')
  .action(getMarket);
