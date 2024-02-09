import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import { getSDK } from '../utils/sdk.js';
import { colors } from '../utils/terminal.js';
import { getJob } from '../job/get.js';
import type { ClientSubscriptionId } from '@solana/web3.js';
export async function view(
  node: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  const nosana: Client = getSDK();
  console.log('Waiting for jobs..');
  await nosana.jobs.loadNosanaJobs();
  const jobProgram = nosana.jobs.jobs!;
  const runAccountFilter: { offset: number; bytes: string; } =
    jobProgram.coder.accounts.memcmp(jobProgram.account.runAccount.idlAccount.name, undefined);
  const coderFilters = [{
    memcmp: {
      offset: runAccountFilter.offset,
      bytes: runAccountFilter.bytes
    },
  },
  {
    memcmp: {
      offset: 40,
      bytes: node,
    },
  }];
  const subscriptionId: ClientSubscriptionId = nosana.jobs.connection!.onProgramAccountChange(
    jobProgram.programId,
    async (event) => {
      nosana.jobs.connection!.removeProgramAccountChangeListener(subscriptionId);
      const runAccount = jobProgram.coder.accounts.decode(jobProgram.account.runAccount.idlAccount.name, event.accountInfo.data);
      const jobAddress = runAccount.job.toString();
      console.log('Job Claimed!', jobAddress);
      await getJob(jobAddress, { wait: true, ...options }, undefined, nosana);
    }, 'confirmed', coderFilters
  )
}
