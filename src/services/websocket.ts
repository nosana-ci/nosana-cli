import WebSocket from 'ws';
import { Client } from '@nosana/sdk';
import { getSDK } from './sdk.js';
import { ConsoleLogger } from './NodeManager/monitoring/log/console/ConsoleLogger.js';
import { configs } from './NodeManager/configs/configs.js';

const logger = new ConsoleLogger(false);

const getSignature = async () => {
  const nosana: Client = getSDK();

  return nosana.authorization.generate(configs().signMessage);
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
      retryCount = 0;
      const message = {
        path: '/log',
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
      ws?.close();
    });

    ws.on('close', () => {
      if (shouldReconnect && retryCount < maxRetries) {
        setTimeout(() => {
          retryCount++;
          connect();
        }, retryDelay);
      } else if (!shouldReconnect) {
      } else {
      }
    });
  };

  connect();

  return {
    close: () => {
      shouldReconnect = false;
      ws?.close();
    },
  };
};
