import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

import { parseWallet } from './parseWallet.js';
import { validatePublicKey } from './validatePublicKey.js';
import { migrateSecertFile } from './migrateSecertFile.js';
import { generateNewWallet } from './generateNewKeyPair.js';
import { tokenTransfer } from './tokenTransfer.js';
import { PublicKey } from '@solana/web3.js';
import { solTransfer } from './solTransfer.js';
import { getSDK } from '../../../../services/sdk.js';
import { NosanaNode } from '../../../../services/NosanaNode.js';

export async function migrateWalletCommand(opts: { [key: string]: string }) {
  console.log(
    chalk.red(
      '\nPlease note that this command should only be used if your wallet has been compromised as part of a known attack.',
    ),
  );

  let walletPath = opts.wallet;

  if (walletPath.startsWith('~')) {
    walletPath = walletPath.replace('~', os.homedir());
  }

  const suspectedKeyPair = parseWallet(walletPath);

  const isCompromised = await validatePublicKey(suspectedKeyPair.publicKey);

  if (isCompromised) {
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
    - Register your new wallet for testgrid.`),
  );

  const hasConfirmed = await confirm({
    message: chalk.red('Do you wish to proceed with the migration?'),
  });

  if (!hasConfirmed) {
    process.exit(0);
  }

  migrateSecertFile(walletPath);
  const newKeyPair = generateNewWallet(walletPath);

  await tokenTransfer(
    suspectedKeyPair,
    new PublicKey('2d7v9xwFcu8BMMW4GqZunxWoRPQBruSxavJ4phSKGHo7'),
  );

  await solTransfer(
    suspectedKeyPair,
    new PublicKey('2d7v9xwFcu8BMMW4GqZunxWoRPQBruSxavJ4phSKGHo7'),
  );

  const node = new NosanaNode(
    getSDK(),
    opts.provider,
    opts.podman,
    opts.config,
    opts.gpu,
  );

  await node.joinTestGrid();
}
