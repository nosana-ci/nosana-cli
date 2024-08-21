import { Client, Job, mapJob } from '@nosana/sdk';
import 'rpc-websockets/dist/lib/client.js';
import { ClientSubscriptionId, PublicKey } from '@solana/web3.js';

import { getSDK } from './sdk.js';

export const EMPTY_ADDRESS = new PublicKey('11111111111111111111111111111111');

const POLLING_INTERVAL = 10000;

export const waitForJobCompletion = async (
  jobAddress: PublicKey,
): Promise<Job> => {
  const nosana: Client = getSDK();
  await nosana.jobs.loadNosanaJobs();
  return new Promise((resolve) => {
    const subscriptionId: ClientSubscriptionId =
      nosana.jobs.connection!.onAccountChange(
        jobAddress,
        (accountInfo) => {
          const jobAccount = nosana.jobs.jobs!.coder.accounts.decode(
            nosana.jobs.jobs!.account.jobAccount.idlAccount.name,
            accountInfo.data,
          );
          if (jobAccount.state >= 2) {
            nosana.jobs.connection!.removeProgramAccountChangeListener(
              subscriptionId,
            );
            resolve(mapJob(jobAccount));
          }
        },
        'confirmed',
      );
  });
};

export const waitForJobRunOrCompletion = async (
  jobAddress: PublicKey,
): Promise<Job> => {
  const nosana: Client = getSDK();
  await nosana.jobs.loadNosanaJobs();

  const getJobRunningPromise = new Promise<Job>((resolve) => {
    const checkCondition = async () => {
      const job: Job = await nosana.jobs.get(jobAddress);
      if (job.state === 'RUNNING') {
        resolve(job);
      } else {
        setTimeout(checkCondition, POLLING_INTERVAL);
      }
    };

    checkCondition();
  });

  const jobCompletionPromise = new Promise<Job>((resolve) => {
    const subscriptionId: ClientSubscriptionId =
      nosana.jobs.connection!.onAccountChange(
        jobAddress,
        (accountInfo) => {
          const jobAccount = nosana.jobs.jobs!.coder.accounts.decode(
            nosana.jobs.jobs!.account.jobAccount.idlAccount.name,
            accountInfo.data,
          );
          if (jobAccount.state >= 2) {
            nosana.jobs.connection!.removeProgramAccountChangeListener(
              subscriptionId,
            );
            resolve(mapJob(jobAccount));
          }
        },
        'confirmed',
      );
  });

  return Promise.race([getJobRunningPromise, jobCompletionPromise]);
};
