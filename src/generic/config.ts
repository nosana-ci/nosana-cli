import { JobDefinition } from '@nosana/sdk';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const modulePath = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  // Setting environment specific config first because override is not set
  // and that means the first value is taken over others
  // (starting at the actual environment before the dotenv files)
  path: [
    resolve(
      modulePath,
      `../../.env.${
        process.env.APP_ENV || process.env.NODE_ENV || 'production'
      }`,
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

// TODO: either check if all the env variables are actually set or move the default values to
// this file when they are not yet set..
export const config: configType = {
  backendUrl: process.env.BACKEND_URL || 'https://dashboard.k8s.prd.nos.ci/api',
  backendSolanaAddress:
    process.env.BACKEND_SOLANA_ADDRESS ||
    '7rFPFnxjXHC2sfDy3qrDa9pEb4j49oivMuV7e8sYDPmB',
  backendAuthorizationAddress: process.env.BACKEND_AUTHORIZATION_ADDRESS || '',
  signMessage: process.env.SIGN_MESSAGE || 'Hello Nosana Node!',
  frp: {
    serverAddr: process.env.FRP_SERVER_ADDRESS || 'node.k8s.prd.nos.ci',
    serverPort: process.env.FRP_SERVER_PORT
      ? parseInt(process.env.FRP_SERVER_PORT)
      : 7000,
    containerImage:
      process.env.FRPC_CONTAINER_IMAGE ||
      'registry.hub.docker.com/nosana/frpc:v1.0.33',
  },
  tunnel: {
    containerImage:
      process.env.TUNNEL_CONTAINER_IMAGE ||
      'registry.hub.docker.com/nosana/tunnel:0.1.0',
  },
  api: {
    port: process.env.API_PORT ? parseInt(process.env.API_PORT) : 8123,
  },
  minDiskSpace: process.env.MIN_DISK_SPACE
    ? parseInt(process.env.MIN_DISK_SPACE)
    : 25000,
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
