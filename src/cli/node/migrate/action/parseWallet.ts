import fs from 'fs';

import web3, { Keypair } from '@solana/web3.js';
import chalk from 'chalk';

export function parseWallet(walletPath: string): Keypair {
  if (!fs.existsSync(walletPath)) {
    console.error(
      chalk.red(`Wallet file not found at ${chalk.red(walletPath)}`),
    );
    process.exit(1);
  }

  const secertKeyFile = JSON.parse(
    fs.readFileSync(walletPath).toString(),
  ) as number[];

  const keyPair = web3.Keypair.fromSecretKey(Uint8Array.from(secertKeyFile));

  return keyPair;
}
