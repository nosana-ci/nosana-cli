import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

import { parseWallet } from './parseWallet.js';
import { validatePublicKey } from './validatePublicKey.js';
import { generateNewWallet } from './generateNewKeyPair.js';
import { tokenTransfer } from './tokenTransfer.js';
import { solTransfer } from './solTransfer.js';
import { exposeSecert } from './exposeSecert.js';

export async function migrateWalletCommand(walletPath: string) {
  console.log(
    chalk.red(
      '\nPlease note that this command should only be used if your wallet has been compromised as part of a known attack.',
    ),
  );

  if (walletPath.startsWith('~')) {
    walletPath = walletPath.replace('~', os.homedir());
  }

  const suspectedKeyPair = parseWallet(walletPath);

  const { isCompromised, isAtRisk } = await validatePublicKey(
    suspectedKeyPair.publicKey,
  );

  if (!isAtRisk) {
    console.log(
      chalk.green(
        `${suspectedKeyPair.publicKey.toString()} has not been flagged as compromised by Nosana. If you believe this is to not be the case, please contact the Nosana team via Discord.`,
      ),
    );
    process.exit(0);
  }

  console.log(
    chalk.yellow(`\n${suspectedKeyPair.publicKey.toString()} has been flagged as compromised by Nosana, making it eligible for migration. This process will involve:
    - Creating a back up of your compromised secret key to ${walletPath}.compromised.
    - Generate and save a new KeyPair to ${walletPath}.
    - Transfer all tokens from the compromised account to the new account. Please note that NFTs, SFTs, and staked tokens will not be included in this transfer.
    - Onboard your new wallet for testgrid.
    ${
      isCompromised
        ? '- Expose your private key to Nosana and reimburse staked amount'
        : ''
    }`),
  );

  const hasConfirmed = await confirm({
    message: chalk.red('Do you wish to proceed with the migration?'),
  });

  if (!hasConfirmed) {
    process.exit(0);
  }

  const newKeyPair = await generateNewWallet(
    walletPath,
    suspectedKeyPair.publicKey,
  );

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

  if (isCompromised) {
    await exposeSecert(suspectedKeyPair);
    console.log(chalk.green('Successfully exposed private key to Nosana'));
  }
}
