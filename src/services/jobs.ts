// external imports
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';

// local imports
import { jobStateMapping, mapJob } from '../utils.js';
import { Keypair, PublicKey, SendTransactionError } from '@solana/web3.js';

import type { Job } from '../types/index.js';
import { SolanaManager } from './solana.js';
import { BN } from '@coral-xyz/anchor';

/**
 * Class to interact with Nosana Secret Manager
 * https://docs.nosana.io/secrets/start.html
 */
export class Jobs extends SolanaManager {
  constructor(...args: any){ super(...args); }
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
  async get(job: PublicKey | string) : Promise<Job> {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.loadNosanaJobs();

    const jobAccount = await this.jobs!.account.jobAccount.fetch(job)
    let runAccount;
    if (jobAccount.state !== 2) {
      try {
        runAccount = (await this.getRuns(job))[0]
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
  async getMultipleJobs(jobs: Array<PublicKey> | Array<string>, fetchRunAccounts:boolean = true) {
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
    return fetchedJobs.map(j => mapJob(j as unknown as Job));
  }

  /**
   * Function to fetch job accounts from chain
   * @param job Publickey address of the job to fetch
   */
  async getAll() {
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

    const accounts = await jobAccount.provider.connection.getProgramAccounts(jobAccount.programId, {
      dataSlice: { offset: 209, length: 8 }, // Fetch timeStart only.
      filters: [...coderFilters],
    })
    const accountsWithTimeStart = accounts.map(({ pubkey, account }) => ({
        pubkey,
        timeStart: new BN(account.data, 'le'),
    }));

    // sort by desc timeStart & put 0 on top
    const sortedAccounts = accountsWithTimeStart.sort((a, b) => {
      function value(el:any) {
        var x = parseFloat(el);
        return x === 0 ? Infinity : x;
      }
      return value(b.timeStart) - value(a.timeStart);
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
