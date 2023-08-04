import {
  AnchorProvider,
  Idl,
  Program,
  setProvider,
  BN,
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
} from '@coral-xyz/anchor/dist/cjs/utils/token.js';
import { bs58, utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';

import type { Jobs, SolanaConfig, Job } from '../types/index.js';
import { KeyWallet, mapJob, jobStateMapping } from '../utils.js';
import { solanaConfigDefault } from '../config_defaults.js';
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider.js';

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
      // @ts-ignore
      this.config.wallet = new KeyWallet(this.config.wallet);
    }
    if (typeof process !== 'undefined' && process.env?.ANCHOR_PROVIDER_URL) {
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
        if (
          e.message.includes(
            'Attempt to debit an account but found no record of a prior credit',
          )
        ) {
          e.message = 'Not enough SOL to make transaction';
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
  async getJob(job: PublicKey | string): Promise<Job> {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.loadNosanaJobs();

    const jobAccount = await this.jobs!.account.jobAccount.fetch(job);
    let runAccount;
    if (jobAccount.state !== 2) {
      try {
        runAccount = (await this.getRuns(job))[0];
        if (runAccount?.account) {
          jobAccount.state = jobStateMapping[1];
          jobAccount.node = runAccount.account.node.toString();
          jobAccount.timeStart = runAccount.account.time;
        }
      } catch (error) {
        console.error('error fetching run account', error);
      }
    }

    return mapJob(jobAccount as unknown as Job);
  }

  /**
   * Function to fetch multiple jobs from chain
   * @param jobs array with Publickey addresses of the jobs to fetch
   */
  async getMultipleJobs(
    jobs: Array<PublicKey> | Array<string>,
    fetchRunAccounts: boolean = true,
  ) {
    if (typeof jobs[0] === 'string')
      jobs = jobs.map((job) => new PublicKey(job));
    await this.loadNosanaJobs();
    let fetchedJobs = await this.jobs!.account.jobAccount.fetchMultiple(jobs);

    // fetch run account
    if (fetchRunAccounts) {
      for (let i = 0; i < fetchedJobs.length; i++) {
        if (fetchedJobs[i]!.state < 2) {
          try {
            const runAccount = (await this.getRuns(jobs[i]))[0];
            if (runAccount?.account && fetchedJobs[i]) {
              fetchedJobs[i]!.state = jobStateMapping[1];
              fetchedJobs[i]!.node = runAccount.account.node.toString();
              fetchedJobs[i]!.timeStart = runAccount.account.time;
            }
          } catch (error) {
            console.error('error fetching run account', error);
          }
        }
      }
    }
    return fetchedJobs.map((j) => mapJob(j as unknown as Job));
  }

  /**
   * Function to fetch job accounts from chain
   * @param job Publickey address of the job to fetch
   */
  async getJobs() {
    await this.loadNosanaJobs();
    const jobAccount = this.jobs!.account.jobAccount;
    const filter: { offset?: number; bytes?: string; dataSize?: number } =
      jobAccount.coder.accounts.memcmp(jobAccount.idlAccount.name, undefined);
    const coderFilters = [];
    if (filter?.offset != undefined && filter?.bytes != undefined) {
      coderFilters.push({
        memcmp: { offset: filter.offset, bytes: filter.bytes },
      });
    }
    if (filter?.dataSize != undefined) {
      coderFilters.push({ dataSize: filter.dataSize });
    }

    const accounts = await jobAccount.provider.connection.getProgramAccounts(
      jobAccount.programId,
      {
        dataSlice: { offset: 209, length: 8 }, // Fetch timeStart only.
        filters: [...coderFilters],
      },
    );
    const accountsWithTimeStart = accounts.map(({ pubkey, account }) => ({
      pubkey,
      timeStart: new BN(account.data, 'le'),
    }));

    // sort by desc timeStart & put 0 on top
    const sortedAccounts = accountsWithTimeStart.sort((a, b) => {
      const at = parseFloat(a.timeStart);
      const bt = parseFloat(b.timeStart);
      if (at === bt) {
        return a.pubkey.toString().localeCompare(b.pubkey.toString());
      }
      if (at === 0) return -1;
      if (bt === 0) return 1;
      return bt - at;
    });

    return sortedAccounts;
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
   * Function to fetch a run of a job from chain
   * @param job Publickey address of the job to fetch
   */
  async getRuns(job: PublicKey | string): Promise<Array<any>> {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.loadNosanaJobs();
    const runAccounts = await this.jobs!.account.runAccount.all([
      { memcmp: { offset: 8, bytes: job.toString() } },
    ]);
    return runAccounts;
  }
}
