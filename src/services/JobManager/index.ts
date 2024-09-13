import { LowSync } from 'lowdb/lib/index.js';

import { PostJobResult, postJobWithOptions } from './actions/post/index.js';
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
    const { id, nodes } = await postJobWithOptions(
      market,
      job,
      options,
      this.workers,
    );

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
