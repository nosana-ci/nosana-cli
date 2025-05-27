import { Client } from '@nosana/sdk';
import { getSDK } from '../../../sdk.js';
import { configs } from '../../configs/configs.js';

export const ping = (() => {
  let instance: PingHandler | null = null;

  return () => {
    if (!instance) {
      instance = new PingHandler();
    }
    instance.start();
    return instance;
  };
})();

export class PingHandler {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {}

  start() {
    if (this.intervalId) return;
    const time = 30; // seconds
    this.intervalId = setInterval(async () => {

      try {
        const sdk = getSDK();
        const address = sdk.solana.provider!.wallet.publicKey;
        const signature = await this.getAuthSignature(sdk);

        const response = await fetch(`${configs().backendUrl}/ping`, {
          method: 'POST',
          headers: {
            Authorization: `${address}:${signature}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ping: 'pong' }),
        });
      } catch (err) {
        console.error('Ping failed:', err);
      }
    }, time * 1000);
  }

  private async getAuthSignature(sdk: Client): Promise<string> {
    const signature = (await sdk.solana.signMessage(
      configs().signMessage,
    )) as Uint8Array;
    return Buffer.from(signature).toString('base64');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
