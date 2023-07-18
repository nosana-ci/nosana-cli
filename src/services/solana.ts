import {
  AnchorProvider,
  Idl,
  Program,
  setProvider,
  Wallet,
} from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
  Connection,
  SendTransactionError,
} from '@solana/web3.js';
import type { Cluster } from '@solana/web3.js';
import {
  associatedAddress,
  TOKEN_PROGRAM_ID,
} from '@coral-xyz/anchor/dist/cjs/utils/token';
import { bs58, utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

import type { Jobs, SolanaConfig } from '../types';
import { solanaConfigDefault } from '../config_defaults';

const pda = (
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey,
): PublicKey => PublicKey.findProgramAddressSync(seeds, programId)[0];

/**
 * Class to interact with Nosana Programs on the Solana Blockchain,
 * with the use of Anchor.
 */
export class SolanaManager {
  provider: AnchorProvider | undefined;
  jobs: Program<Jobs> | undefined;
  accounts: object | undefined;
  config: SolanaConfig = solanaConfigDefault;
  constructor(config?: Partial<SolanaConfig>) {
    Object.assign(this.config, config);
    if (
      typeof this.config.wallet === 'string' ||
      Array.isArray(this.config.wallet)
    ) {
      let key = this.config.wallet;
      if (typeof key === 'string') {
        key = JSON.parse(key);
      }
      this.config.wallet = Keypair.fromSecretKey(
        new Uint8Array(key as Iterable<number>),
      );
    }

    if (this.config.wallet instanceof Keypair) {
      this.config.wallet = new Wallet(this.config.wallet);
    }
    if (process?.env.ANCHOR_PROVIDER_URL) {
      // TODO: figure out if we want to support this or not
      this.provider = AnchorProvider.env();
    } else {
      let node = this.config.network;
      if (!this.config.network.includes('http')) {
        node = clusterApiUrl(this.config.network as Cluster);
      }
      const connection = new Connection(node, 'confirmed');
      this.provider = new AnchorProvider(
        connection,
        this.config.wallet as Wallet,
        {},
      );
    }
    setProvider(this.provider);
  }

  /**
   * Function to load the Nosana Jobs program into JS
   * https://docs.nosana.io/programs/jobs.html
   */
  async loadNosanaJobs() {
    if (!this.jobs) {
      const programId = new PublicKey(this.config.jobs_address);
      const idl = (await Program.fetchIdl(programId.toString())) as Idl;
      this.jobs = new Program(idl, programId) as unknown as Program<Jobs>;
    }
  }

  /**
   * Function to set and calculate most account addresses needed for instructions
   */
  async setAccounts() {
    if (!this.accounts) {
      await this.loadNosanaJobs();
      const authority = this.provider!.wallet.publicKey;
      const rewardsProgram = new PublicKey(this.config.rewards_address);
      const mint = new PublicKey(this.config.nos_address);
      const market = new PublicKey(this.config.market_address);
      this.accounts = {
        market,
        vault: pda([market.toBuffer(), mint.toBuffer()], this.jobs!.programId),
        user: await associatedAddress({
          mint,
          owner: this.provider!.wallet.publicKey,
        }),
        payer: authority,
        authority,
        rewardsVault: pda([mint.toBuffer()], rewardsProgram),
        rewardsReflection: pda([utf8.encode('reflection')], rewardsProgram),
        rewardsProgram,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
    }
  }

  /**
   * Fiunction to list a Nosana Job in a market
   * @param ipfsHash String of the IPFS hash locating the Nosana Job data.
   */
  async listJob(ipfsHash: string) {
    await this.loadNosanaJobs();
    await this.setAccounts();
    const jobKey = Keypair.generate();
    const runKey = Keypair.generate();
    try {
    const tx = await this.jobs!.methods.list([
      ...bs58.decode(ipfsHash).subarray(2),
    ])
      .accounts({
        ...this.accounts,
        job: jobKey.publicKey,
        run: runKey.publicKey,
      })
      .signers([jobKey, runKey])
      .rpc();
      return {
        tx,
        job: jobKey.publicKey.toBase58(),
        run: runKey.publicKey.toBase58(),
      };
    } catch (e: any) {
      if (e instanceof SendTransactionError) {
        if (e.message.includes('Attempt to debit an account but found no record of a prior credit')) {
          e.message = 'Not enough SOL to make transaction'
          throw e;
        }
      }
      throw e;
    }

  }

  /**
   * Function to fetch a job from chain
   * @param job Publickey address of the job to fetch
   */
  async getJob(job: PublicKey | string) {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.loadNosanaJobs();
    return await this.jobs!.account.jobAccount.fetch(job);
  }

  /**
   * Function to fetch a run from chain
   * @param run Publickey address of the run to fetch
   */
  async getRun(run: PublicKey | string) {
    if (typeof run === 'string') run = new PublicKey(run);
    await this.loadNosanaJobs();
    return await this.jobs!.account.runAccount.fetch(run);
  }
  /**
   * Function to fetch a job from chain
   * @param job Publickey address of the job to fetch
   */
  async getRuns(job: PublicKey | string) {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.loadNosanaJobs();
    return await this.jobs!.account.runAccount.all([
      { memcmp: { offset: 8, bytes: job.toBase58() } },
    ]);
  }
}
