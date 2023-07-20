import type { Wallet } from '@coral-xyz/anchor/dist/cjs/provider';
import type { Keypair } from '@solana/web3.js';

export type SolanaConfig = {
  network: string;
  jobs_address: string;
  nos_address: string;
  market_address: string;
  rewards_address: string;
  wallet: Wallet | string | Keypair | Iterable<number>;
};

export type SecretsConfig = {
  manager: string;
  wallet: Wallet | string | Keypair | Iterable<number>;
};

export type IPFSConfig = {
  api: string;
  gateway: string;
  jwt?: string;
};

export type ClientConfig = {
  solana?: Partial<SolanaConfig>;
  ipfs?: Partial<IPFSConfig>;
  secrets?: Partial<SecretsConfig>;
};
