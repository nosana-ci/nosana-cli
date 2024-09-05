import { LowSync } from 'lowdb/lib/index.js';

import { jobListener } from './listener/index.js';
import { DB, NodeDb } from '../../providers/modules/db/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { postJob, PostJobResult } from './actions/post/index.js';

export default class JobManager {
  private db: LowSync<NodeDb>;
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

  public async post(
    market: string,
    job: JobDefinition,
  ): Promise<PostJobResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await postJob(market, job);
        this.jobs.set(result.job, result);
        this.updateJobDB(result.job, result);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
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
