import { Wallet } from '@coral-xyz/anchor';
import { Client, ClientConfig } from '@nosana/sdk';
import fs from 'fs';
import os from 'os';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fetch from 'node-fetch';
import { colors } from '../generic/utils.js';

let nosana: Client;

export async function setSDK(
  network: string,
  market: string | undefined,
  keyfile: string,
  airdrop: boolean = false,
) {
  const config: ClientConfig = {
    solana: {
      network: network,
      nos_address: network.includes('devnet')
        ? 'devr1BGQndEW5k5zfvG5FsLyZv1Ap73vNgAHcQ9sUVP'
        : 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7',
      jobs_address: network.includes('devnet')
        ? 'nosJTmGQxvwXy23vng5UjkTbfv91Bzf9jEuro78dAGR'
        : 'nosJhNRqr2bc9g1nfGDcXXTXvYUmxD4cVwy2pMWhrYM',
    },
    secrets: {
      manager: network.includes('devnet')
        ? 'https://secrets.k8s.dev.nos.ci/'
        : 'https://secrets.k8s.prd.nos.ci/',
    },
  };
  if (market) {
    config.solana!.market_address = market;
  }
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
        config.solana!.wallet = privateKey;
      } else {
        console.log(
          `Creating new keypair and storing it in ${colors.CYAN}${keyfile}${colors.RESET}\n`,
        );

        const keypair = Keypair.generate();
        fs.writeFileSync(
          keyfile,
          JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data),
        );
        config.solana!.wallet = keypair;
      }
    }
  }

  nosana = new Client(config);

  console.log(
    `Network:\t${colors.GREEN}${nosana.solana.config.network}${colors.RESET}`,
  );
  if (keyfile) {
    const solBalance = await nosana.solana.getSolBalance();
    const nosBalance = await nosana.solana.getNosBalance();

    console.log(
      `Wallet:\t\t${colors.GREEN}${(
        nosana.solana.config.wallet as Wallet
      ).publicKey.toString()}${colors.RESET}`,
    );

    console.log(
      `SOL balance:\t${colors.GREEN}${solBalance / LAMPORTS_PER_SOL} SOL${colors.RESET
      }`,
    );
    console.log(
      `NOS balance:\t${colors.GREEN}${nosBalance ? nosBalance.uiAmount : 0} NOS${colors.RESET
      }`,
    );

    if (
      airdrop &&
      nosana.solana.config.network.includes('devnet') &&
      (solBalance < 0.03 * LAMPORTS_PER_SOL ||
        !nosBalance ||
        !nosBalance.uiAmount ||
        nosBalance.uiAmount < 1)
    ) {
      console.log('\nNot enough SOL or NOS, requesting airdrop');
      try {
        const airdropResult = await fetch(
          `https://backend.k8s.dev.nos.ci/airdrop?address=${(
            nosana.solana.config.wallet as Wallet
          ).publicKey.toString()}`,
        );
        console.log(
          `Received airdrop ${colors.CYAN}${JSON.stringify(airdropResult)}${colors.RESET
          }`,
        );
      } catch (error) {
        throw new Error('Couldnt airdrop tokens to your address');
      }
      // if (await nosana.solana.requestAirdrop(1e9)) {
      //   console.log(`Received airdrop of ${colors.CYAN}1 SOL!${colors.RESET}`);
      // } else {
      //   console.error('Could not receive airdrop');
      // }
    }
  }
  console.log('---------------------------------');
}
export function getSDK() {
  return nosana;
}
