import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

import { parseWallet } from './parseWallet.js';
import { validatePublicKey } from './validatePublicKey.js';
import { generateNewWallet } from './generateNewKeyPair.js';
import { tokenTransfer } from './tokenTransfer.js';
import { solTransfer } from './solTransfer.js';
import { reimburse } from './reimburse.js';
import { getSDK } from '../../../../services/sdk.js';
import { Keypair } from '@solana/web3.js';

export async function migrateWalletCommand(
  walletPath: string,
  startup = false,
): Promise<boolean> {
  if (!startup) {
    console.log(
      chalk.red(
        '\nThis command is intended for cases where your wallet is suspected to be compromised or if you wish to migrate for added security.',
      ),
    );
  }
  if (!walletPath) return false;

  if (walletPath.startsWith('~')) {
    walletPath = walletPath.replace('~', os.homedir());
  }

  // const suspectedKeyPair = parseWallet(walletPath);
  const nosana = getSDK();
  // @ts-ignore we need to ignore because wallet can also be without a private key
  const suspectedKeyPair: Keypair = nosana.solana.wallet.payer;

  const { isCompromised, isAtRisk, reimbursementTransaction, newNodeAddress } =
    await validatePublicKey(suspectedKeyPair.publicKey);

  if (!isAtRisk) return false;

  // Migrate if we don't have a new node yet
  if (!newNodeAddress) {
    let heading = `\n${suspectedKeyPair.publicKey.toString()} might be compromised or is already compromised due to exposure to a malicious hack in an official solana package, making it eligible for migration`;

    console.log(
      chalk.yellow(`${heading}. This process will involve:
    - Creating a back up of your compromised secret key to ${walletPath}.compromised.${suspectedKeyPair.publicKey.toString()}.
    - Generate and save a new KeyPair to ${walletPath}.
    - Transfer all tokens from the compromised account to the new account. Please note that NFTs, SFTs, and staked tokens will not be included in this transfer.
    - Onboard your new wallet for testgrid.`),
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
        `Transfered possible NOS tokens and SOL, any remaining will need to be manually transfered.`,
      ),
    );
  } else {
    return false;
  }

  if (!startup) {
    console.log(chalk.green('Migration complete.'));
  }

  return true;
}
