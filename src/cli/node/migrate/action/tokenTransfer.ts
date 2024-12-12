import ora from 'ora';
import chalk from 'chalk';
import { Client } from '@nosana/sdk';

import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

import { getSDK } from '../../../../services/sdk.js';

export async function tokenTransfer(
  compromisedKeyPair: Keypair,
  newPublicKey: PublicKey,
) {
  const sdk: Client = getSDK();
  const connection = sdk.solana.connection!;

  // Fetch the token accounts of the source public key
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    compromisedKeyPair.publicKey,
    {
      programId: TOKEN_PROGRAM_ID,
    },
  );

  for (let { account, pubkey } of tokenAccounts.value) {
    const mintAddress = account.data.parsed.info.mint;
    const tokenAmountLamports = parseInt(
      account.data.parsed.info.tokenAmount.amount,
    );
    const tokenAmount = account.data.parsed.info.tokenAmount.uiAmount;

    // Skip empty token accounts
    if (tokenAmount === 0) continue;

    // Only transfer NOS
    if (
      mintAddress.toString() !== 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7'
    )
      continue;

    const spinner = ora(
      chalk.cyan(
        `Transfering token account ${mintAddress} with balance of ${tokenAmount} to ${newPublicKey.toString()}.`,
      ),
    ).start();

    // Find the associated token address of the destination account for this token mint
    try {
      const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        compromisedKeyPair,
        new PublicKey(mintAddress),
        newPublicKey,
      );

      // Send the transaction to the network
      const transaction = new Transaction().add(
        createTransferInstruction(
          pubkey, // Source token account
          destinationTokenAccount.address, // Destination token account
          compromisedKeyPair.publicKey, // Payer
          tokenAmountLamports,
        ),
      );

      await sendAndConfirmTransaction(connection, transaction, [
        compromisedKeyPair,
      ]);

      spinner.succeed();
    } catch (e) {
      spinner.fail((e as Error).message);
    }
  }
}
