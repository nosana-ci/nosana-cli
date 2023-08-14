import { PublicKey } from "@solana/web3.js";

export type Node = {
  address: PublicKey;
  authority: PublicKey;
  audited: boolean;
  architecture: number;
  country: number | string | null;
  cpu: number;
  gpu: number;
  memory: number;
  iops: number;
  storage: number;
  icon: string;
  endpoint: string;
  version: string;
  flag: string;
};
