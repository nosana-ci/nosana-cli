import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const modulePath = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(
    modulePath,
    `../../.env.${process.env.APP_ENV || process.env.NODE_ENV || 'production'}`,
  ),
});

export type configType = {
  backendUrl: string;
  backendSolanaAddress: string;
  signMessage: string;
  frp: {
    serverAddr: string;
    serverPort: number;
  };
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
  signMessage: process.env.SIGN_MESSAGE || 'Hello Nosana Node!',
  frp: {
    serverAddr: process.env.FRP_SERVER_ADDRESS || 'node.k8s.prd.nos.ci',
    serverPort: process.env.FRP_SERVER_PORT
      ? parseInt(process.env.FRP_SERVER_PORT)
      : 7000,
  },
  api: {
    port: process.env.API_PORT ? parseInt(process.env.API_PORT) : 8123,
  },
  minDiskSpace: process.env.MIN_DISK_SPACE
    ? parseInt(process.env.MIN_DISK_SPACE)
    : 25000,
};
