import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { isVersionedTransaction } from '@coral-xyz/anchor/dist/esm/utils/common';

/**
 * Method to pause the process
 * @param seconds Number of seconds to pause
 */
const sleep = (seconds: number): Promise<void> =>
  new Promise((res) => setTimeout(res, seconds * 1e3));

/**
 * Method to easily get a universal timestamp
 */
const now = (): number => Math.floor(Date.now() / 1e3);
class KeyWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if (isVersionedTransaction(tx)) {
      tx.sign([this.payer]);
    } else {
      tx.partialSign(this.payer);
    }

    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return txs.map((t) => {
      if (isVersionedTransaction(t)) {
        t.sign([this.payer]);
      } else {
        t.partialSign(this.payer);
      }
      return t;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

export { now, sleep, KeyWallet };
