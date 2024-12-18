import WebSocket from 'ws';
import { Client } from '@nosana/sdk';
import { getSDK } from './sdk.js';
import { ConsoleLogger } from './NodeManager/monitoring/log/console/ConsoleLogger.js';
import { configs } from './NodeManager/configs/configs.js';

const logger = new ConsoleLogger();

const getSignature = async () => {
  const nosana: Client = getSDK();
  const signature = (await nosana.solana.signMessage(
    configs().signMessage,
  )) as Uint8Array;
  const base64Signature = Buffer.from(signature).toString('base64');

  return `${nosana.solana.wallet.publicKey.toString()}:${base64Signature}`;
};

const getAddress = () => {
  const nosana: Client = getSDK();
  return `${nosana.solana.wallet.publicKey.toString()}`;
};

export const listenToWebSocketLogs = (
  url: string,
  job: string,
  maxRetries = Infinity,
  retryDelay = 3000,
) => {
  let retryCount = 0;
  let ws: WebSocket | null = null;
  let shouldReconnect = true;

  const connect = () => {
    ws = new WebSocket(url);

    ws.on('open', async () => {
      retryCount = 0; // Reset retry count upon successful connection
      const message = {
        path: '/log', // or "status" depending on the request
        body: {
          jobAddress: job,
          address: getAddress(),
        },
        header: await getSignature(),
      };

      ws?.on('message', (message) => {
        const response = JSON.parse(message.toString());
        if (response.path === 'log') {
          logger.update(JSON.parse(response.data), false);
        }
      });

      ws?.send(JSON.stringify(message));
    });

    ws.on('error', () => {
      console.warn('WebSocket connection error');
      ws?.close();
    });

    ws.on('close', () => {
      if (shouldReconnect && retryCount < maxRetries) {
        setTimeout(() => {
          retryCount++;
          connect();
        }, retryDelay);
      } else if (!shouldReconnect) {
        console.info('WebSocket connection closed by user.');
      } else {
        console.warn(
          'Max retry attempts reached, unable to connect to WebSocket.',
        );
      }
    });
  };

  connect();

  // Return a controller object to manage the WebSocket instance
  return {
    close: () => {
      shouldReconnect = false; // Prevent reconnecting
      ws?.close();
    },
  };
};
