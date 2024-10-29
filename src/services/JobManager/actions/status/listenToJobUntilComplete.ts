import { PublicKey } from '@solana/web3.js';

import { StatusEmitter } from './statusEmitter.js';
import {
  waitForJobCompletion,
  waitForJobRunOrCompletion,
} from '../../../jobs.js';
import { createListener } from './createListener.js';
import { getSDK } from '../../../sdk.js';

export async function listenToJobUntilComplete(
  jobId: string,
  statusEmitter: StatusEmitter,
) {
  return new Promise(async (resolve) => {
    const nosana = getSDK();
    const id = new PublicKey(jobId);
    const { node, state } = await nosana.jobs.get(id);

    statusEmitter.emitStatus(jobId, node, state);

    if (['COMPLETED', 'STOPPED'].includes(`${state}`)) {
      resolve(true);
    }

    const { node: runNode, state: runState } = await waitForJobRunOrCompletion(
      id,
    );

    if (runState === 'RUNNING') {
      if (state !== runState) {
        statusEmitter.emitStatus(jobId, runNode, runState);
      }
      createListener(runNode, jobId, statusEmitter);
    }

    const { node: finalNode, state: finalState } = await waitForJobCompletion(
      id,
    );

    statusEmitter.emitStatus(jobId, finalNode, finalState);
    resolve(true);
  });
}
