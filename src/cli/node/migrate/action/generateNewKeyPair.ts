import fs from 'fs';
import { Keypair, PublicKey } from '@solana/web3.js';

import { config } from '../../../../generic/config.js';
import { migrateSecertFile } from './migrateSecertFile.js';
import { getSDK } from '../../../../services/sdk.js';

export async function generateNewWallet(
  walletPath: string,
  suspectedKeyPair: Keypair,
): Promise<Keypair> {
  const keypair = Keypair.generate();

  const signature = (await getSDK().solana.signMessage(
    config.signMessage,
  )) as Uint8Array;
  const base64Signature = Buffer.from(signature).toString('base64');

  try {
    const response = await fetch(
      `${
        config.backendUrl
      }/nodes/${suspectedKeyPair.publicKey.toString()}/update`,
      {
        method: 'POST',
        headers: {
          Authorization: `${suspectedKeyPair.publicKey.toString()}:${base64Signature}`,
          'Content-Type': 'text/plain',
        },
        body: keypair.publicKey.toString(),
      },
    );
    if (response.status !== 200)
      throw new Error('Failed to update your nodes new wallet address.');
  } catch {
    throw new Error('Failed to update your nodes new wallet address.');
  }

  migrateSecertFile(walletPath, suspectedKeyPair.publicKey.toString());

  fs.writeFileSync(
    walletPath,
    JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data),
  );

  return keypair;
}
