import { NodeConfigsSingleton } from './NodeConfigs.js';
import { loadConfigurationValue } from '../../../generic/utils';

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
  tunnel: { containerImage: string };
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
    backendUrl: loadConfigurationValue('BACKEND_URL'),
    backendSolanaAddress: loadConfigurationValue('BACKEND_SOLANA_ADDRESS'),
    backendAuthorizationAddress: loadConfigurationValue(
      'BACKEND_AUTHORIZATION_ADDRESS',
    ),
    explorerUrl: loadConfigurationValue('EXPLORER_URL'),
    signMessage: loadConfigurationValue('SIGN_MESSAGE'),
    frp: {
      serverAddr: loadConfigurationValue('FRP_SERVER_ADDRESS'),
      serverPort: parseInt(loadConfigurationValue('FRP_SERVER_PORT')),
      containerImage: loadConfigurationValue('FRP_SERVER_IMAGE'),
    },
    tunnel: {
      containerImage: loadConfigurationValue('TUNNEL_CONTAINER_IMAGE'),
    },
    api: {
      port: parseInt(loadConfigurationValue('API_PORT')),
    },
    minDiskSpace: parseInt(loadConfigurationValue('MIN_DISK_SPACE')),
    network: options?.network ?? 'mainnet',
  };
};
