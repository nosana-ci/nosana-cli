import type { SolanaConfig, IPFSConfig, SecretsConfig } from './types/index.js';
import { KeyWallet } from './utils.js';
import { Keypair } from '@solana/web3.js';

const wallet =
  //@ts-ignore
  process?.env?.SOLANA_WALLET || new KeyWallet(Keypair.generate());

export const solanaConfigDefault: SolanaConfig = {
  network: process?.env?.SOLANA_NETWORK || 'devnet',
  jobs_address:
    process?.env?.JOBS_ADDRESS || 'nosJTmGQxvwXy23vng5UjkTbfv91Bzf9jEuro78dAGR',
  nos_address:
    process?.env?.NOS_ADDRESS || 'devr1BGQndEW5k5zfvG5FsLyZv1Ap73vNgAHcQ9sUVP',
  market_address:
    process?.env?.MARKET_ADDRESS ||
    '7nxXoihx65yRGZiGzWZsFMz8D7qwxFePNKvDBWZnxc41',
  rewards_address:
    process?.env?.REWARDS_ADDRESS ||
    'nosRB8DUV67oLNrL45bo2pFLrmsWPiewe2Lk2DRNYCp',
  nodes_address:
    process?.env?.NODES_ADDRESS ||
    'nosNeZR64wiEhQc5j251bsP4WqDabT6hmz4PHyoHLGD',
  wallet: wallet,
};

export const secretsConfigDefault: SecretsConfig = {
  manager: process?.env?.SECRETS_MANAGER || 'https://secrets.k8s.dev.nos.ci/',
  wallet: wallet,
};

export const IPFSConfigDefault: IPFSConfig = {
  api: process?.env?.IPFS_API || 'https://api.pinata.cloud',
  jwt: process?.env?.IPFS_JWT,
  gateway: process?.env?.IPFS_GATEWAY || 'https://nosana.mypinata.cloud/ipfs/',
};
