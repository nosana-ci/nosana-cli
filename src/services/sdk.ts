import { Wallet } from '@coral-xyz/anchor';
import { Client, ClientConfig } from '@nosana/sdk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import 'rpc-websockets/dist/lib/client.js';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { colors } from '../generic/utils';
import { getConfig } from '../config';
import chalk from 'chalk';

let nosana: Client;

export async function setSDK(
  network: string,
  rpc: string | undefined,
  market: string | undefined,
  keyfile: string,
  airdrop: boolean = false,
): Promise<Client> {
  const envConfig = await getConfig();
  const config: ClientConfig = {
    solana: {
      priority_fee: 100000,
    },
  };
  if (market) config.solana!.market_address = market;

  let wallet: Wallet | string | Keypair | Iterable<number> | undefined =
    undefined;
  if (keyfile) {
    if (!process?.env?.SOLANA_WALLET) {
      if (keyfile && keyfile[0] === '~') {
        keyfile = keyfile.replace('~', os.homedir());
      }
      if (fs.existsSync(keyfile)) {
        console.log(
          `Reading keypair from ${colors.CYAN}${keyfile}${colors.RESET}\n`,
        );
        const privateKey = fs.readFileSync(keyfile, 'utf8');
        wallet = privateKey;
      } else {
        console.log(
          `Creating new keypair and storing it in ${colors.CYAN}${keyfile}${colors.RESET}\n`,
        );

        const keypair = Keypair.generate();
        fs.mkdirSync(path.dirname(keyfile), { recursive: true });
        fs.writeFileSync(
          keyfile,
          JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data),
        );
        wallet = keypair;
      }
    }
  }

  if (rpc) {
    config.solana!.network = rpc;
  }
  nosana = new Client(network, wallet, config);
  if (!rpc && network === 'mainnet' && wallet) {
    // sign message for authentication
    const signature = (await nosana.solana.signMessage(
      envConfig.signMessage,
    )) as Uint8Array;
    const base64Signature = Buffer.from(signature).toString('base64');
    const node = nosana.solana.wallet.publicKey.toString();
    const response = await fetch(`${envConfig.backendUrl}/rpc`, {
      method: 'GET',
      headers: {
        Authorization: `${node}:${base64Signature}`,
        'Content-Type': 'application/json',
      },
    });
    const rpcFromBackend = await response.json();
    if (response.status !== 200) {
      console.log(chalk.red('Could not retrieve RPC'));
      throw new Error(rpcFromBackend.message);
    } else {
      config.solana!.network = rpcFromBackend.url;
      nosana = new Client(network, wallet, config);
    }
  }

  console.log(`Network:\t${colors.GREEN}${network}${colors.RESET}`);
  if (keyfile) {
    const solBalance = await nosana.solana.getSolBalance();
    const nosBalance = await nosana.solana.getNosBalance();

    console.log(
      `Wallet:\t\t${colors.GREEN}${nosana.solana.wallet.publicKey.toString()}${
        colors.RESET
      }`,
    );

    console.log(
      `SOL balance:\t${colors.GREEN}${solBalance / LAMPORTS_PER_SOL} SOL${
        colors.RESET
      }`,
    );
    console.log(
      `NOS balance:\t${colors.GREEN}${
        nosBalance ? nosBalance.uiAmount : 0
      } NOS${colors.RESET}`,
    );
    if (
      airdrop &&
      network.includes('devnet') &&
      solBalance < 0.01 * LAMPORTS_PER_SOL
      // || !nosBalance ||
      // !nosBalance.uiAmount ||
      // nosBalance.uiAmount < 1
    ) {
      console.log('\nNot enough SOL, requesting airdrop');
      try {
        // const airdropResult = await fetch(
        //   `https://backend.k8s.dev.nos.ci/airdrop?address=${nosana.solana.wallet.publicKey.toString()}`,
        // );
        if (await nosana.solana.requestAirdrop(1e9)) {
          console.log(
            `Received airdrop of ${colors.CYAN}1 SOL!${colors.RESET}`,
          );
        } else {
          throw new Error('Couldnt airdrop tokens to your address');
        }
      } catch (error) {
        throw new Error('Couldnt airdrop tokens to your address');
      }
    }
  }
  return nosana;
}
export function getSDK() {
  return nosana;
}

export const getRawTransaction = async (
  encodedTransaction: Uint8Array,
): Promise<Transaction | VersionedTransaction> => {
  try {
    return Transaction.from(encodedTransaction);
  } catch (error) {
    return VersionedTransaction.deserialize(encodedTransaction);
  }
};
