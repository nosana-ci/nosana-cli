import { Command } from 'commander';

import { walletOption } from '../../sharedOptions/index.js';
import { migrateWalletCommand } from './action/index.js';

export const migrateNodeCommand = new Command('migrate')
  .description(
    'Migrate your node to a new wallet, generating a new key before transferring all tokens',
  )
  .addOption(walletOption)
  .action((opts) => migrateWalletCommand(opts.wallet));
