import { Wallet } from '@coral-xyz/anchor';
import { Client, ClientConfig } from '../index.js';
import fs from 'node:fs';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { colors } from './terminal.js';

let nosana: Client;

export async function setSDK(network: string, keyfile: string) {
  const config: ClientConfig = {
    solana: {
      network: network,
    },
  };

  if (!process?.env?.SOLANA_WALLET) {
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

  nosana = new Client(config);

  const solBalance = await nosana.solana.getSolBalance();
  const nosBalance = await nosana.solana.getNosBalance();

  console.log(
    `Wallet:\t\t${colors.GREEN}${(
      nosana.solana.config.wallet as Wallet
    ).publicKey.toString()}${colors.RESET}`,
  );
  console.log(
    `Network:\t${colors.GREEN}${nosana.solana.config.network}${colors.RESET}`,
  );
  console.log(
    `SOL balance:\t${colors.GREEN}${solBalance / LAMPORTS_PER_SOL} SOL${
      colors.RESET
    }`,
  );
  console.log(
    `NOS balance:\t${colors.GREEN}${nosBalance ? nosBalance.uiAmount : 0} NOS${
      colors.RESET
    }`,
  );
  if (nosana.solana.config.network.includes('devnet') && solBalance === 0) {
    console.log('\nNo SOL, requesting airdrop');
    if (await nosana.solana.requestAirdrop(1e9)) {
      console.log(`Received airdrop of ${colors.CYAN}1 SOL!${colors.RESET}`);
    } else {
      console.error('Could not receive airdrop');
    }
  }
  console.log('---------------------------------');
}
export function getSDK() {
  return nosana;
}

export * from './run.js';
export * from './get.js';
