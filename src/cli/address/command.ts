import { Command, program } from 'commander';

import { getAddress } from './action.js';
import { networkOption } from '../sharedOptions/network.js';
import { walletOption } from '../sharedOptions/wallet.js';

export const addressCommand: Command = program
  .command('address')
  .description('Print your public key address')
  .addOption(walletOption)
  .addOption(networkOption)
  .action(getAddress);
