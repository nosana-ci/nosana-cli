import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import { JobObject, JobPostingOptions } from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';
import { DEFAULT_OFFSET_SEC } from './definitions/index.js';
import { EventEmitter } from 'node:stream';
import { PublicKey } from '@solana/web3.js';
import { waitForJobRunOrCompletion } from '../jobs.js';

export default class JobManager {
  public state: JobManagerState;
  private workers: Map<string, NodeJS.Timeout>;

  constructor(config: string) {
    this.state = new JobManagerState(config);
    this.workers = new Map();
  }

  public stop(job: string): string | Error {
    if (!this.workers.has(job)) {
      return new Error('Failed to find job');
    }

    clearTimeout(this.workers.get(job));
    return job;
  }

  public status(id: string) {
    const event = new EventEmitter();

    const job = this.state.get(id);

    const createListener = (node: string, job: string) => {};

    const validateJob = async (address: string): Promise<boolean> => {
      const job = await waitForJobRunOrCompletion(new PublicKey(address));
      if (job.state === 'RUNNING') return true;
      return false;
    };

    if (job) {
      job.active_nodes.forEach((node) => {});

      this.state.subscribe(id, async (event, value) => {
        const source = new EventSource('');
        source.onmessage = (event) => {};
      });
    }
  }

  public async post(
    market: string,
    job: JobDefinition,
    options: JobPostingOptions,
  ): Promise<JobObject> {
    const { group_id, recursive, recursive_offset_min } = options;
    if (group_id && this.state.get(group_id)) {
      throw new Error(
        'Group id already exists, please stop the existing group or update the group.',
      );
    }

    const result = await postJobWithOptions(
      market,
      job,
      options,
      ({ id, active_nodes }) => {
        const timeout = active_nodes[0].job_timeout;
        if (recursive) {
          this.workers.set(
            id,
            setTimeout(
              () => this.post(market, job, options),
              timeout -
                (recursive_offset_min
                  ? recursive_offset_min * 60
                  : DEFAULT_OFFSET_SEC) *
                  1000,
            ),
          );
        }
      },
    );

    this.state.set(result.id, result);

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
