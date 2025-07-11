import { Client as SDK } from '@nosana/sdk';
import { getSDK } from '../../../sdk.js';
import { configs } from '../../configs/configs.js';
import { PublicKey } from '@solana/web3.js';

export const ping = (() => {
  let instance: PingHandler | null = null;

  return async () => {
    if (!instance) {
      instance = new PingHandler();
    }
    await instance.start();
    return instance;
  };
})();

export class PingHandler {
  private timeoutId: NodeJS.Timeout | null = null;
  private intervalSeconds = 30;

  private sdk: SDK;
  private address: PublicKey;

  constructor() {
    this.sdk = getSDK();
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  async start() {
    if (this.timeoutId) return;

    // start with an immediate ping
    await this.scheduleNextPing(Date.now());
  }

private async scheduleNextPing(expectedTime: number) {
  await this.ping();

  const nextExpected = expectedTime + this.intervalSeconds * 1000;

  const delay = Math.max(nextExpected - Date.now(), 0);
  this.timeoutId = setTimeout(() => {
    this.scheduleNextPing(nextExpected);
  }, delay);
}

  private async ping() {
    try {
      const response = await fetch(`${configs().backendUrl}/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `${this.address}:${await this.getAuthSignature()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ping: 'pong' }),
      });

      if (response.ok) {
        const json = await response.json();

        if (json.maxHeartbeatsPerDay) {
          const newInterval = Math.floor(
            (24 * 60 * 60) / json.maxHeartbeatsPerDay,
          );
 
          if (newInterval !== this.intervalSeconds) {
            this.intervalSeconds = newInterval;
          }
        }
      }
    } catch (err) {
      console.error('Ping failed:', err);
    }
  }

  private async getAuthSignature(): Promise<string> {
    const signature = (await this.sdk.solana.signMessage(
      configs().signMessage,
    )) as Uint8Array;
    return Buffer.from(signature).toString('base64');
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
