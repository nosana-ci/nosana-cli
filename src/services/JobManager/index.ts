import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import { JobObject, JobPostingOptions } from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';

export default class JobManager {
  public state: JobManagerState;
  private workers = new Map();

  constructor(config: string) {
    this.state = new JobManagerState(config);
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
  ): Promise<JobObject> {
    const result = await postJobWithOptions(market, job, options, this.workers);

    // nodes.forEach((job) => this.updateJobDB(job.job, job));

    return result;
  }

  public get(id: string): JobObject | undefined {
    return this.state.get(id);
  }

  public list(): string[] {
    // @ts-ignore
    return this.state.list();
  }

  public listen(port: number) {
    jobListener(port, this);
  }
}
