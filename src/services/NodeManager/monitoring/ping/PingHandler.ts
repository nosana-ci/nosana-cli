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
        const headers = sdk.authorization.generateHeader(
          configs().signMessage,
          {
            includeTime: true,
          },
        );
        headers.append('Content-Type', 'application/json');

        const response = await fetch(`${configs().backendUrl}/ping`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ping: 'pong' }),
        });
      } catch (err) {
        console.error('Ping failed:', err);
      }
    }, time * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
