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
  private intervalSeconds = 30;

  constructor() {}

  async start() {
    if (this.intervalId) return;

    await this.ping(); // start immediately to get the interval

    this.intervalId = setInterval(() => {
      this.ping();
    }, this.intervalSeconds * 1000);
  }

  private async ping() {
    try {
      const sdk = getSDK();
      const headers = sdk.authorization.generateHeader(configs().signMessage, {
        includeTime: true,
      });
      headers.append('Content-Type', 'application/json');

      const response = await fetch(`${configs().backendUrl}/api/nodes/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ping: 'pong' }),
      });

      if (response.ok) {
        const json = await response.json();

        if (json.maxHeartbeatsPerDay) {
          const newInterval = Math.floor((24 * 60 * 60) / json.maxHeartbeatsPerDay);
          if (newInterval !== this.intervalSeconds) {
            this.updateInterval(newInterval);
          }
        }
      }
    } catch (err) {
      console.error('Ping failed:', err);
    }
  }

  private updateInterval(newSeconds: number) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalSeconds = newSeconds;
    this.intervalId = setInterval(() => {
      this.ping();
    }, this.intervalSeconds * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
