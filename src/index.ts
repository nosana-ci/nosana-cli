import type { ClientConfig } from './types';
import { IPFS, SolanaManager, SecretManager } from './services';
export * from './services';

export class Client {
  solana: SolanaManager;
  ipfs: IPFS;
  secrets: SecretManager;

  constructor(config?: Partial<ClientConfig>) {
    this.solana = new SolanaManager(config?.solana);
    this.ipfs = new IPFS(config?.ipfs);
    this.secrets = new SecretManager(config?.secrets);
  }
}
