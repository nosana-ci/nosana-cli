import { LowSync } from 'lowdb/lib/index.js';

import { jobListener } from './listener/index.js';
import { DB, NodeDb } from '../../providers/modules/db/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { asyncPostJob, PostJobResult } from './actions/post/index.js';
import { randomUUID } from 'node:crypto';
import { getMarket } from './actions/getMarket/index.js';

const DEFAULT_OFFSET_SEC = 5;

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
    recursive = false,
  ): Promise<{
    id: string;
    nodes: PostJobResult[];
  }> {
    let id;

    const handlePostJob = async () => {
      const result = await asyncPostJob(market, job);
      this.jobs.set(result.job, result);
      this.updateJobDB(result.job, result);
      return result;
    };

    const result = await handlePostJob();
    id = result.job;

    if (recursive) {
      try {
        id = randomUUID();
        const timeout = (await getMarket(market)).jobTimeout;

        console.log((timeout - DEFAULT_OFFSET_SEC) * 1000);

        this.workers.set(
          id,
          setInterval(async () => {
            await handlePostJob();
          }, (timeout - DEFAULT_OFFSET_SEC) * 1000),
        );
      } catch (e) {
        throw e;
      }
    }

    return { id, nodes: [result] };
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
