import { PublicKey } from '@solana/web3.js';

import { getSDK } from '../../../sdk.js';
import { waitForJobRunOrCompletion } from '../../../jobs.js';
import { postStopJobServiceURLWithRetry } from './postStopJobServiceURLWithRetry.js';

export async function stopJob(
  jobId: string,
  waitForRunning = false,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const nosana = getSDK();
    const id = new PublicKey(jobId);

    let nodeAddress;
    try {
      const { node, state } = await nosana.jobs.get(id);
      nodeAddress = node;

      if (state === 'QUEUED') {
        if (waitForRunning) {
          nodeAddress = (await waitForJobRunOrCompletion(id)).node;
        } else {
          reject();
        }
      }

      if (state === 'RUNNING') {
        await postStopJobServiceURLWithRetry(nodeAddress, jobId, undefined, {
          interval: 0,
          attempts: 1,
        });
        resolve(jobId);
      }
    } catch {
      reject();
    }
  });
}
