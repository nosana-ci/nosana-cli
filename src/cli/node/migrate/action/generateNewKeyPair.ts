import fs from 'fs';
import { Keypair } from '@solana/web3.js';

export function generateNewWallet(walletPath: string): Keypair {
  const keypair = Keypair.generate();

  fs.writeFileSync(
    walletPath,
    JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data),
  );

  return keypair;
}
