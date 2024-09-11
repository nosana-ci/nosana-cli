import { LowSync } from 'lowdb/lib/index.js';

import { jobListener } from './listener/index.js';
import { DB, NodeDb } from '../../providers/modules/db/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { postJob, PostJobResult } from './actions/post/index.js';
import { JobWorker } from './workers/index.js';
import { randomUUID } from 'node:crypto';
import { getMarket } from './actions/getMarket/index.js';

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

  private async postHandler(
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
    const id = randomUUID();
    if (recursive) {
      try {
        const timeout = (await getMarket(market)).jobTimeout;

        this.workers.set(
          id,
          setInterval(() => {
            console.log('POSTING');
            // this.postHandler(market, job);
          }, 500),
        );
      } catch (e) {
        throw e;
      }
    }

    const result = await this.postHandler(market, job);

    this.jobs.set(result.job, result);
    this.updateJobDB(result.job, result);

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
