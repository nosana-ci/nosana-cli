import { JobDefinition } from '../../../NodeManager/provider/types.js';
import { JobResult } from '../../listener/types/index.js';
import { postJob } from './postJob.js';

export function asyncPostJob(
  market: string,
  job: JobDefinition,
): Promise<JobResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await postJob(market, job);
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}
