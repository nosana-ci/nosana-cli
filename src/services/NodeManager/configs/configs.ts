import { NodeConfigsSingleton } from './NodeConfigs.js';

export type configType = {
  isNodeRun: boolean;
  backendUrl: string;
  backendSolanaAddress: string;
  backendAuthorizationAddress: string;
  explorerUrl: string;
  signMessage: string;
  frp: {
    serverAddr: string;
    serverPort: number;
    containerImage: string;
  };
  api: {
    port: number;
  };
  minDiskSpace: number;
  network: 'devnet' | 'mainnet';
};

export const configs = (options?: { [key: string]: any }): configType => {
  NodeConfigsSingleton.getInstance(options);

  return {
    isNodeRun: options?.isNodeRun,
    backendUrl:
      process.env.BACKEND_URL || 'https://dashboard.k8s.prd.nos.ci/api',
    backendSolanaAddress:
      process.env.BACKEND_SOLANA_ADDRESS ||
      '7rFPFnxjXHC2sfDy3qrDa9pEb4j49oivMuV7e8sYDPmB',
    backendAuthorizationAddress:
      process.env.BACKEND_AUTHORIZATION_ADDRESS || '',
    explorerUrl: process.env.EXPLORER_URL || 'https://dashboard.nosana.com',
    signMessage: process.env.SIGN_MESSAGE || 'Hello Nosana Node!',
    frp: {
      serverAddr: process.env.FRP_SERVER_ADDRESS || 'node.k8s.prd.nos.ci',
      serverPort: process.env.FRP_SERVER_PORT
        ? parseInt(process.env.FRP_SERVER_PORT)
        : 7000,
      containerImage:
        process.env.FRP_SERVER_IMAGE ||
        'registry.hub.docker.com/nosana/frpc:v1.0.33',
    },
    api: {
      port: process.env.API_PORT ? parseInt(process.env.API_PORT) : 8123,
    },
    minDiskSpace: process.env.MIN_DISK_SPACE
      ? parseInt(process.env.MIN_DISK_SPACE)
      : 25000,
    network: options?.network ?? 'mainnet',
  };
};
