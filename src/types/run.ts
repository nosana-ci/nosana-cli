import { PublicKey } from "@solana/web3.js";


export type Run = {
  account: {
    job: PublicKey;
    node: PublicKey;
    payer: PublicKey;
    state: number;
    time: number;
  };
  publicKey: PublicKey;
};
