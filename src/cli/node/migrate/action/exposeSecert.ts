import { Keypair } from '@solana/web3.js';
import { config } from '../../../../generic/config';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

export async function exposeSecert(compromisedKeyPair: Keypair) {
  try {
    const encodedKey = bs58.encode(compromisedKeyPair.secretKey);

    await fetch(
      `${
        config.backendUrl
      }/nodes/${compromisedKeyPair.publicKey.toString()}/update`,
      {
        method: 'POST',
        headers: {
          // TODO: ADD HEADERS
        },
        body: encodedKey,
      },
    );
  } catch (e) {
    throw new Error(
      `Failed to expose secerts to Nosana.\n${(e as Error).message}`,
    );
  }
}
