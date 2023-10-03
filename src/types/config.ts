import type { Wallet } from '@coral-xyz/anchor/dist/cjs/provider.js';
import type { Keypair } from '@solana/web3.js';

export type SolanaConfig = {
  network: string;
  jobs_address: string;
  nos_address: string;
  market_address: string;
  rewards_address: string;
  nodes_address: string;
  stake_address: string;
  wallet: Wallet | string | Keypair | Iterable<number> | null;
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
