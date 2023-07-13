// support fetch in node version <18
import './utils/fetch-polyfill';

import type { ClientConfig, BlockchainConfig } from './types';

export class Client {
  blockchain: BlockchainConfig = {
    network: process?.env.BLOCKCHAIN_NETWORK || 'devnet',
  };

  constructor(config?: Partial<ClientConfig>) {
    Object.assign(this.blockchain, config?.blockchain);
  }
}
