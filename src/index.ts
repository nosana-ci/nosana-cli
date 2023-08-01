import type { ClientConfig } from './types/index.js';
import { IPFS, SolanaManager, SecretManager } from './services/index.js';
export * from './services/index.js';
export * from './types/index.js';

// polyfill buffer for browser
import * as buffer from 'buffer';
if (typeof window !== 'undefined') {
  window.Buffer = buffer.Buffer;
}

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
