import { randomUUID } from 'node:crypto';
import { LowSync } from 'lowdb/lib/index.js';

import { PostJobResult } from './actions/post/index.js';
import { getMarket } from './actions/getMarket/index.js';
import { asyncPostJob } from './actions/post/asyncPostJob.js';
import { DEFAULT_OFFSET_SEC } from './definitions/index.js';
import { jobListener } from './listener/index.js';
import { JobPostingOptions } from './listener/types/index.js';
import { DB, NodeDb } from '../../providers/modules/db/index.js';
import { JobDefinition } from '../../providers/Provider.js';

export default class JobManager {
  private db: LowSync<NodeDb>;
  private workers = new Map();
  private jobs: Map<string, PostJobResult>;

  constructor(config: string) {
    this.db = new DB(config).db;
    this.jobs = new Map(Object.entries(this.db.data.jobs));
  }

  private updateJobDB(key: string, job: PostJobResult | undefined) {
    if (!job) {
      delete this.db.data.jobs[key];
    } else {
      this.db.data.jobs[key] = job;
    }

    this.db.write();
  }

  public stop(job: string): string | Error {
    if (!this.workers.has(job)) {
      return new Error('Failed to find job');
    }

    clearInterval(this.workers.get(job));
    return job;
  }

  public async post(
    market: string,
    job: JobDefinition,
    options: JobPostingOptions,
  ): Promise<{
    id: string;
    nodes: PostJobResult[];
  }> {
    const nodes: PostJobResult[] = [];
    const { group_id, recursive, recursive_offset_min, replica_count } =
      options;

    if (group_id) {
      if (this.workers.has(group_id)) {
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
      this.jobs.set(result.job, result);
      this.updateJobDB(result.job, result);
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

        this.workers.set(
          id,
          setTimeout(async () => {
            await this.post(market, job, options);
          }, timeout - (recursive_offset_min ? recursive_offset_min * 60 : DEFAULT_OFFSET_SEC) * 1000),
        );
      } catch (e) {
        throw e;
      }
    }

    return { id, nodes };
  }

  public get(id: string): PostJobResult | undefined {
    return this.jobs.get(id);
  }

  public list(): string[] {
    return [...this.jobs.keys()];
  }

  public listen(port: number) {
    jobListener(port, this);
  }
}
