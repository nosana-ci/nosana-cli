// external imports
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';

// local imports
import { jobStateMapping, mapJob, excludedJobs } from '../utils.js';
import { Keypair, PublicKey, SendTransactionError } from '@solana/web3.js';

import type { Job, Market } from '../types/index.js';
import { SolanaManager } from './solana.js';
import { BN } from '@coral-xyz/anchor';

/**
 * Class to interact with the Nosana Jobs Program
 * https://docs.nosana.io/secrets/start.html
 */
export class Jobs extends SolanaManager {
  constructor(...args: any) {
    super(...args);
  }
  /**
   * Fiunction to list a Nosana Job in a market
   * @param ipfsHash String of the IPFS hash locating the Nosana Job data.
   */
  async list(ipfsHash: string) {
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
  async get(job: PublicKey | string): Promise<Job> {
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
  async getMultiple(
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
  async all(filters?: { [key: string]: any }) {
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
    if (filters) {
      if (filters.state >= 0) {
        coderFilters.push({
          memcmp: {
            offset: 208,
            bytes: bs58.encode(Buffer.from([filters.state])),
          },
        });
      }
      if (filters.project) {
        coderFilters.push({
          memcmp: {
            offset: 176,
            bytes: filters.project,
          },
        });
      }
      if (filters.node) {
        coderFilters.push({
          memcmp: {
            offset: 104,
            bytes: filters.node,
          },
        });
      }
      if (filters.market) {
        console.log('filter', filters);
        coderFilters.push({
          memcmp: {
            offset: 72,
            bytes: filters.market,
          },
        });
      }
    }

    const accounts = await jobAccount.provider.connection.getProgramAccounts(
      jobAccount.programId,
      {
        dataSlice: { offset: 208, length: 17 }, // Fetch timeStart only.
        filters: [...coderFilters],
      },
    );
    const filterExcludedJobs = accounts.filter(({ pubkey, account }) => {
      if (excludedJobs.includes(pubkey.toString())) return false;
      return true;
    });
    const accountsWithTimeStart = filterExcludedJobs.map(({ pubkey, account }) => ({
        pubkey,
        state: account.data[0],
        timeStart: parseFloat(new BN(account.data.slice(9), 'le')),
        timeEnd: parseFloat(new BN(account.data.slice(1, 9), 'le')),
    }));

    // sort by desc timeStart & put 0 on top
    const sortedAccounts = accountsWithTimeStart.sort((a, b) => {
      if (a.state === b.state) {
        if (a.timeStart === b.timeStart) {
          return a.pubkey.toString().localeCompare(b.pubkey.toString());
        }
        if (a.timeStart === 0) return -1;
        if (b.timeStart === 0) return 1;
        return b.timeStart - a.timeStart;
      }
      return a.state - b.state;
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

  /**
   * Function to fetch a market from chain
   * @param market Publickey address of the market to fetch
   */
  async getMarket(market: PublicKey | string) {
    if (typeof market === 'string') market = new PublicKey(market);
    await this.loadNosanaJobs();
    const marketAccount = await this.jobs!.account.marketAccount.fetch(market.toString());
    //@ts-ignore
    return {...marketAccount, address: marketAccount.publicKey};
  }

  /**
   * Function to fetch all markets
   */
  async allMarkets(): Promise<Array<any>> {
    await this.loadNosanaJobs();
    const marketAccounts = await this.jobs!.account.marketAccount.all();
    return marketAccounts.map((m: any) => {
      m.account.address = m.publicKey;
      return m.account as Market;
    });
  }
}
