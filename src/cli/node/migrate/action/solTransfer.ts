import chalk from 'chalk';
import ora from 'ora';
import { Client } from '@nosana/sdk';
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import { getSDK } from '../../../../services/sdk.js';

export async function solTransfer(
  compromisedKeyPair: Keypair,
  newPublicKey: PublicKey,
) {
  const sdk: Client = getSDK();
  const connection = sdk.solana.connection!;

  const solBalance = await sdk.solana.getSolBalance(
    compromisedKeyPair.publicKey,
  );

  if (solBalance - 0.01 * 1e9 <= 0) {
    return;
  }

  const spinner = ora(
    chalk.cyan(`Transfering ${solBalance} SOL to ${newPublicKey.toString()}.`),
  ).start();

  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: compromisedKeyPair.publicKey,
        toPubkey: newPublicKey,
        lamports: solBalance - 50000000,
      }),
    );

    await sendAndConfirmTransaction(connection, transaction, [
      compromisedKeyPair,
    ]);
    spinner.succeed();
  } catch (err) {
    spinner.fail((err as Error).message);
  }
}
