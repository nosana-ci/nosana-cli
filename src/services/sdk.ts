import { Wallet } from '@coral-xyz/anchor';
import { Client, ClientConfig } from '@nosana/sdk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { colors } from '../generic/utils.js';

let nosana: Client;

export async function setSDK(
  network: string,
  rpc: string | undefined,
  market: string | undefined,
  keyfile: string,
  airdrop: boolean = false,
): Promise<Client> {
  const config: ClientConfig = {
    solana: {
      priority_fee: 100000,
    },
  };
  if (rpc) config.solana!.network = rpc;
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

  nosana = new Client(network, wallet, config);

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
