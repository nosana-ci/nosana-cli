import type { ClientConfig, SolanaConfig } from './types';
import { IPFS, SolanaManager } from './services';
export * from './services';

export class Client {
  solana: SolanaManager;
  ipfs: IPFS;

  constructor(config?: Partial<ClientConfig>) {
    this.solana = new SolanaManager(config?.solana);
    this.ipfs = new IPFS(config?.ipfs);
  }
}
