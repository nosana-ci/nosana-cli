import { JobDefinition } from '../../../../providers/Provider.js';
import { PostJobResult } from './index.js';
import { postJob } from './postJob.js';

export function asyncPostJob(
  market: string,
  job: JobDefinition,
): Promise<PostJobResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await postJob(market, job);
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}
