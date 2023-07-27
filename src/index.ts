import type { ClientConfig } from './types/index';
import { IPFS, SolanaManager, SecretManager } from './services';
export * from './services/index';
export * from './types/index';

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
