import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

import { parseWallet } from './parseWallet.js';
import { validatePublicKey } from './validatePublicKey.js';
import { generateNewWallet } from './generateNewKeyPair.js';
import { tokenTransfer } from './tokenTransfer.js';
import { solTransfer } from './solTransfer.js';
import { reimburse } from './reimburse.js';

export async function migrateWalletCommand(
  walletPath: string,
  startup = false,
) {
  if (!startup) {
    console.log(
      chalk.red(
        '\nThis command is intended for cases where your wallet is suspected to be compromised or if you wish to migrate for added security.',
      ),
    );
  }
  if (!walletPath) return;

  if (walletPath.startsWith('~')) {
    walletPath = walletPath.replace('~', os.homedir());
  }

  const suspectedKeyPair = parseWallet(walletPath);

  const { isCompromised, isAtRisk, reimbursementTransaction, newNodeAddress } =
    await validatePublicKey(suspectedKeyPair.publicKey);

  if (!isAtRisk) return;

  // Migrate if we don't have a new node yet
  if (!newNodeAddress) {
    let heading = `\n${suspectedKeyPair.publicKey.toString()} might be compromised or is already compromised due to exposure to a malicious hack in an official solana package, making it eligible for migration`;

    console.log(
      chalk.yellow(`${heading}. This process will involve:
    - Creating a back up of your compromised secret key to ${walletPath}.compromised.${suspectedKeyPair.publicKey.toString()}.
    - Generate and save a new KeyPair to ${walletPath}.
    - Transfer all tokens from the compromised account to the new account. Please note that NFTs, SFTs, and staked tokens will not be included in this transfer.
    - Onboard your new wallet for testgrid.
    ${
      isCompromised && false
        ? '- Staked NOS will be slashed and reimbursed to your new wallet as liquid NOS.'
        : ''
    }`),
    );

    const hasConfirmed = await confirm({
      message: chalk.red('Do you wish to proceed with the migration?'),
    });

    if (!hasConfirmed) {
      process.exit(0);
    }

    const newKeyPair = await generateNewWallet(walletPath, suspectedKeyPair);

    console.log(
      chalk.green(
        `\nSucessfully generated and onboarded new wallet. Please ensure you back up your new wallet stored at ${walletPath}.`,
      ),
    );

    await tokenTransfer(suspectedKeyPair, newKeyPair.publicKey);

    await solTransfer(suspectedKeyPair, newKeyPair.publicKey);

    console.log(
      chalk.yellow(
        `Transfered all possible tokens and SOL, any remaining will need to be manually transfered.`,
      ),
    );
  }

  if (isCompromised && !reimbursementTransaction && false) {
    const hasConfirmedSlash = await confirm({
      message: chalk.cyan(
        "Would you like to transfer your staked NOS from your potentially compromised wallet to your new wallet as liquid NOS? If you agree, your staked NOS in the old account will be slashed, and you'll receive the equivalent amount as liquid NOS in your new wallet. Please ensure that any unclaimed staking rewards are claimed before proceeding with this transfer.",
      ),
    });

    if (hasConfirmedSlash) {
      await reimburse(suspectedKeyPair);
      console.log(chalk.green('Successfully reimbursed node.'));
    }
  }

  if (!startup) {
    console.log(chalk.green('Migration complete.'));
  }
}
