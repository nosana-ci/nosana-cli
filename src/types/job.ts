import { PublicKey } from '@solana/web3.js';

export type Job = {
  ipfsJob: string;
  ipfsResult: string;
  market: PublicKey;
  node: string;
  payer: PublicKey;
  price: number;
  project: PublicKey;
  state: string;
  timeEnd: number;
  timeStart: number;
};
