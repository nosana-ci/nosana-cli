import { PublicKey } from "@solana/web3.js";

export type Node = {
  authority: PublicKey;
  audited: boolean;
  architecture: number;
  country: number;
  cpu: number;
  gpu: number;
  memory: number;
  iops: number;
  storage: number;
  icon: string;
  endpoint: string;
  version: string;
};
