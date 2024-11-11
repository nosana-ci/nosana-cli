import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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

export class NodeConfigs {
  constructor() {}

  loadVariablesToEnv(options: { [key: string]: any }) {
    const env = options.network === 'mainnet' ? 'production' : 'dev';

    const modulePath = dirname(fileURLToPath(import.meta.url));

    dotenv.config({
      path: resolve(modulePath, `../../../../.env.${env}`),
      override: true,
    });
  }
}

export const configs = (options? : { [key: string]: any }): configType => {
  if(options){
    new NodeConfigs().loadVariablesToEnv(options)
  }

  return {
    backendUrl:
      process.env.BACKEND_URL || 'https://dashboard.k8s.prd.nos.ci/api',
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
};
