import { PublicKey } from '@solana/web3.js';

export type Job = {
  ipfsJob: Array<number>;
  ipfsResult: Array<number>;
  market: PublicKey;
  node: string;
  payer: PublicKey;
  price: string;
  project: PublicKey;
  state: string;
  timeEnd: string;
  timeStart: string;
};
