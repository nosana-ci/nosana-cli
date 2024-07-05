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
  backendUrl: process.env.BACKEND_URL!,
  backendSolanaAddress: process.env.BACKEND_SOLANA_ADDRESS!,
  signMessage: process.env.SIGN_MESSAGE!,
  frp: {
    serverAddr: process.env.FRP_SERVER_ADDRESS!,
    serverPort: parseInt(process.env.FRP_SERVER_PORT!),
  },
  api: {
    port: parseInt(process.env.API_PORT!),
  },
  minDiskSpace: parseInt(process.env.MIN_DISK_SPACE!),
};
