import { PublicKey } from "@solana/web3.js";

export type Market = {
  address: PublicKey;
  authority: PublicKey;
  jobExpiration: number;
  jobPrice: number;
  jobTimeout: number;
  jobType: number;
  vault: PublicKey;
  vaultBump: number;
  nodeAccessKey: PublicKey;
  nodeXnosMinimum: number;
  queueType: number;
  queue: PublicKey;
};
