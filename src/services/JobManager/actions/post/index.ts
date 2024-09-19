import { randomUUID } from 'crypto';

import { JobDefinition } from '../../../../providers/Provider.js';
import {
  JobObject,
  JobPostingOptions,
  JobResult,
} from '../../listener/types/index.js';
import { asyncPostJob } from './asyncPostJob.js';

export async function postJobWithOptions(
  market: string,
  job: JobDefinition,
  options: JobPostingOptions,
  callback?: (job: JobObject) => void,
): Promise<JobObject> {
  const nodes: JobResult[] = [];
  const { group_id, recursive, recursive_offset_min, replica_count } = options;

  if (group_id) {
    job.ops.forEach((_, i) => {
      if (job.ops[i].type === 'container/run') {
        // @ts-ignore
        job.ops[i].args.env = {
          // @ts-ignore
          ...job.ops[i].args.env,
          NOSANA_GROUP_ID: group_id,
        };
      }
    });
  }

  const postFunctions = [];

  for (let i = 0; i < (replica_count || 1); i++) {
    postFunctions.push(asyncPostJob(market, job));
  }

  const results = await Promise.all(postFunctions);
  results.forEach((result) => {
    nodes.push(result);
    // this.jobs.set(result.job, result);
    // this.updateJobDB(result.job, result);
  });

  if (nodes.length === 0) {
    throw new Error('Failed to post any jobs.');
  }

  const id = group_id
    ? group_id
    : !recursive && nodes.length > 1
    ? nodes[0].job
    : randomUUID();

  const result = {
    id,
    recursive: !!recursive,
    active_nodes: nodes,
    expired_nodes: [],
  };

  if (callback) {
    callback(result);
  }

  return result;
}
