import { Keypair } from '@solana/web3.js';

import { config } from '../../../../generic/config.js';
import { getSDK } from '../../../../services/sdk.js';

export async function reimburse(compromisedKeyPair: Keypair) {
  try {
    const signature = (await getSDK().solana.signMessage(
      config.signMessage,
    )) as Uint8Array;
    const base64Signature = Buffer.from(signature).toString('base64');

    await fetch(
      `${
        config.backendUrl
      }/nodes/${compromisedKeyPair.publicKey.toString()}/reimburse`,
      {
        method: 'POST',
        headers: {
          Authorization: `${compromisedKeyPair.publicKey.toString()}:${base64Signature}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (e) {
    throw new Error(`Failed to reimburse node.\n${(e as Error).message}`);
  }
}
