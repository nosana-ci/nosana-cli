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
  const solFee = 0.003 * 1e9;
  if (solBalance - solFee <= 0) {
    return;
  }

  const spinner = ora(
    chalk.cyan(
      `Transfering ${solBalance / 1e9} SOL to ${newPublicKey.toString()}.`,
    ),
  ).start();

  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: compromisedKeyPair.publicKey,
        toPubkey: newPublicKey,
        lamports: solBalance - solFee,
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
