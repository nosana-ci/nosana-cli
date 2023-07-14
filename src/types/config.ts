import type { Wallet } from '@coral-xyz/anchor';

export type SolanaConfig = {
  network: string;
  jobs_address: string;
  nos_address: string;
  market_address: string;
  rewards_address: string;
  wallet: Wallet;
};

export type IPFSConfig = {
  api: string;
  gateway: string;
  jwt?: string;
};

export type ClientConfig = {
  solana?: Partial<SolanaConfig>;
  ipfs?: Partial<IPFSConfig>;
};
