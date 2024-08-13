import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { Wallet } from '@coral-xyz/anchor';
import { Client, ClientConfig } from '@nosana/sdk';
import path from 'path';
import 'rpc-websockets/dist/lib/client.js';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  TokenAmount,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { colors } from '../generic/utils.js';
import { config as envConfig } from '../generic/config.js';
import { OptionValues } from 'commander';
import { OUTPUT_EVENTS } from '../providers/utils/ouput-formatter/outputEvents.js';
import { outputFormatSelector } from '../providers/utils/ouput-formatter/outputFormatSelector.js';

let nosana: Client;
let nosBalance: TokenAmount | undefined, solBalance: number;

export async function setSDK(
  network: string,
  rpc: string | undefined,
  market: string | undefined,
  keyfile: string,
  options: OptionValues,
): Promise<Client> {
  const formatter = outputFormatSelector(options.format);

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
        formatter.output(OUTPUT_EVENTS.READ_KEYFILE, { keyfile: keyfile });
        const privateKey = fs.readFileSync(keyfile, 'utf8');
        wallet = privateKey;
      } else {
        formatter.output(OUTPUT_EVENTS.CREATE_KEYFILE, { keyfile: keyfile });
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
    try {
      const response = await fetch(`${envConfig.backendUrl}/rpc`, {
        method: 'GET',
        headers: {
          Authorization: `${node}:${base64Signature}`,
          'Content-Type': 'application/json',
        },
      });
      const rpcFromBackend = await response.json();
      if (response.status !== 200) {
        console.log(
          chalk.yellow(
            'Using default solana RPC. Some commands might not work, please provide your own with the --rpc option',
          ),
        );
        // throw new Error(rpcFromBackend.message);
      }
      config.solana!.network = rpcFromBackend.url;
      nosana = new Client(network, wallet, config);
    } catch (e) {
      console.log(
        chalk.yellow(
          'Using default solana RPC. Some commands might not work, please provide your own with the --rpc option',
        ),
      );
      // throw e;
    }
  }
  if (network) {
    formatter.output(OUTPUT_EVENTS.OUTPUT_NETWORK, { network });
  }
  if (keyfile) {
    solBalance = await nosana.solana.getSolBalance();
    nosBalance = await nosana.solana.getNosBalance();

    formatter.output(OUTPUT_EVENTS.OUTPUT_WALLET, {
      publicKey: nosana.solana.wallet.publicKey.toString(),
    });
    formatter.output(OUTPUT_EVENTS.OUTPUT_BALANCES, {
      nos: nosBalance?.uiAmount?.toString() ?? '0',
      sol: solBalance / LAMPORTS_PER_SOL,
    });

    if (
      options.airdrop &&
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
          formatter.throw(OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR, {
            error: new Error('Airdrop Request Failed'),
          });
        }
      } catch (error) {
        formatter.throw(OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR, {
          error: error as Error,
        });
      }
    }
  }
  return nosana;
}
export function getSDK() {
  return nosana;
}

export function getNosBalance() {
  return nosBalance;
}
export function getSolBalance() {
  return solBalance;
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
