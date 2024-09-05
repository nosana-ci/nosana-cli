import { DB } from '../../providers/modules/db/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { postJob, PostJobResult } from './actions/post/index.js';
import { jobListener } from './listener/index.js';

export default class JobManager {
  private db; // Soon to be used to persist jobs
  private jobs: Map<string, PostJobResult>;

  constructor(config: string) {
    this.db = new DB(config);
    this.jobs = new Map();
  }

  public async post(
    market: string,
    job: JobDefinition,
  ): Promise<PostJobResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await postJob(market, job);
        this.jobs.set(result.job, result);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  }

  public listen(port: number) {
    jobListener(port, this);
  }
}
