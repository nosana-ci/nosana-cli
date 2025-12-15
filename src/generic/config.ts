import { JobDefinition } from '@nosana/sdk';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadConfigurationValue } from './utils.js';

const modulePath = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  // Setting environment specific config first because override is not set
  // and that means the first value is taken over others
  // (starting at the actual environment before the dotenv files)
  path: [
    resolve(
      modulePath,
      `../../.env.${process.env.APP_ENV || process.env.NODE_ENV || 'prd'}`,
    ),
    resolve(modulePath, '../../.env'),
  ],
});

export type configType = {
  backendUrl: string;
  backendSolanaAddress: string;
  backendAuthorizationAddress: string;
  signMessage: string;
  frp: {
    serverAddr: string;
    serverPort: number;
    containerImage: string;
  };
  tunnel: { containerImage: string };
  api: {
    port: number;
  };
  minDiskSpace: number;
};

export const config: configType = {
  backendUrl: loadConfigurationValue('BACKEND_URL'),
  backendSolanaAddress: loadConfigurationValue('BACKEND_SOLANA_ADDRESS'),
  backendAuthorizationAddress: loadConfigurationValue(
    'BACKEND_AUTHORIZATION_ADDRESS',
  ),
  signMessage: loadConfigurationValue('SIGN_MESSAGE'),
  frp: {
    serverAddr: loadConfigurationValue('FRP_SERVER_ADDRESS'),
    serverPort: parseInt(loadConfigurationValue('FRP_SERVER_PORT')),
    containerImage: loadConfigurationValue('FRPC_CONTAINER_IMAGE'),
  },
  tunnel: {
    containerImage: loadConfigurationValue('TUNNEL_CONTAINER_IMAGE'),
  },
  api: {
    port: parseInt(loadConfigurationValue('API_PORT')),
  },
  minDiskSpace: parseInt(loadConfigurationValue('MIN_DISK_SPACE')),
};

export const privateBlankJobDefintion: JobDefinition = {
  version: '0.1',
  type: 'container',
  meta: {
    trigger: 'cli',
  },
  logistics: {
    send: {
      type: 'api-listen',
      args: {},
    },
    receive: {
      type: 'api-listen',
      args: {},
    },
  },
  ops: [],
};
