import { Client, Job } from "@nosana/sdk";
import { getSDK } from "../utils/sdk";
import { ClientSubscriptionId, PublicKey } from "@solana/web3.js";

export const waitForJobCompletion = async (jobAddress: PublicKey): Promise<Job> => {
  const nosana: Client = getSDK();
  await nosana.jobs.loadNosanaJobs();
  return new Promise((resolve, reject) => {
    const subscriptionId: ClientSubscriptionId = nosana.jobs.connection!.onAccountChange(
      jobAddress,
      (accountInfo) => {
        const jobAccount = nosana.jobs.jobs!.coder.accounts.decode(nosana.jobs.jobs!.account.jobAccount.idlAccount.name, accountInfo.data);
        if (jobAccount.state >= 2) {
          nosana.jobs.connection!.removeProgramAccountChangeListener(subscriptionId);
          resolve(jobAccount);
        }
      }, 'confirmed'
    );
  });
}