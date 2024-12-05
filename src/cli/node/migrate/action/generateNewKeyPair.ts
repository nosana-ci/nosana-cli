import fs from 'fs';
import { Keypair, PublicKey } from '@solana/web3.js';

import { config } from '../../../../generic/config';
import { migrateSecertFile } from './migrateSecertFile';

export async function generateNewWallet(
  walletPath: string,
  publicKey: PublicKey,
): Promise<Keypair> {
  const keypair = Keypair.generate();

  try {
    await fetch(`${config.backendUrl}/nodes/${publicKey.toString()}/update`, {
      method: 'POST',
      headers: {
        // TODO: ADD HEADERS
      },
      body: keypair.publicKey.toString(),
    });
  } catch {
    throw new Error('Failed to update your nodes new wallet address.');
  }

  migrateSecertFile(walletPath);

  fs.writeFileSync(
    walletPath,
    JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data),
  );

  return keypair;
}
