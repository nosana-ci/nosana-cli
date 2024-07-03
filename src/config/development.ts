import { configType } from '.';

export const config: configType = {
  backendUrl: process?.env?.BACKEND_URL || 'http://localhost:3000/api',
  backendSolanaAddress:
    process?.env?.BACKEND_SOLANA_ADDRESS ||
    '7rFPFnxjXHC2sfDy3qrDa9pEb4j49oivMuV7e8sYDPmB',
  signMessage: process?.env?.SIGN_MESSAGE || 'Hello Nosana Node!',
  frp: {
    serverAddr: process?.env?.FRP_SERVER_ADDR || 'node.k8s.dev.nos.ci',
    serverPort: process?.env?.FRP_SERVER_PORT
      ? parseInt(process?.env?.FRP_SERVER_PORT)
      : 7000,
  },
  // 25GB
  minDiskSpace: 25000,
};
