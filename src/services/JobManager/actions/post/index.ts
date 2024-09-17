import { randomUUID } from 'crypto';

import { JobDefinition } from '../../../../providers/Provider.js';
import {
  JobObject,
  JobPostingOptions,
  JobResult,
} from '../../listener/types/index.js';
import { asyncPostJob } from './asyncPostJob.js';
import { getMarket } from '../getMarket/index.js';
import { DEFAULT_OFFSET_SEC } from '../../definitions/index.js';

export async function postJobWithOptions(
  market: string,
  job: JobDefinition,
  options: JobPostingOptions,
  workers: Map<string, NodeJS.Timeout>,
): Promise<JobObject> {
  const nodes: JobResult[] = [];
  const { group_id, recursive, recursive_offset_min, replica_count } = options;

  if (group_id) {
    if (workers.has(group_id)) {
      throw new Error(
        'Group id already exists, please stop the existing group or update the group.',
      );
    }

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
    : recursive || nodes.length <= 1
    ? nodes[0].job
    : randomUUID();

  if (recursive) {
    try {
      const timeout = (await getMarket(market)).jobTimeout;

      workers.set(
        id,
        setTimeout(async () => {
          await postJobWithOptions(market, job, options, workers);
        }, timeout - (recursive_offset_min ? recursive_offset_min * 60 : DEFAULT_OFFSET_SEC) * 1000),
      );
    } catch (e) {
      throw e;
    }
  }

  return { id, active_nodes: nodes, expired_nodes: [] };
}
