import { Client } from '@nosana/sdk';

import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import { JobObject, JobPostingOptions } from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';
import { getSDK } from '../sdk.js';
import { StatusEmitter } from './actions/status/statusEmitter.js';
import { recurisveTimeout } from './actions/post/helpers/getRecursiveTimeout.js';
import { listenToJobUntilComplete } from './actions/status/index.js';
import { stopJob } from './actions/stop/index.js';

export default class JobManager {
  protected state: JobManagerState;
  private nosana: Client;
  private workers: Map<string, NodeJS.Timeout>;

  constructor(configPath: string) {
    this.state = new JobManagerState(configPath);
    this.nosana = getSDK();
    this.workers = new Map();
  }

  public async status(
    id: string,
    onEvent: (msg: {}) => void,
    onClose: () => void,
  ) {
    await this.nosana.jobs.loadNosanaJobs();

    let init = true;
    const processedIds = new Set<string>();
    const statusEmitter = new StatusEmitter();

    statusEmitter.on('event', onEvent);
    statusEmitter.on('close', onClose);

    this.state.subscribe(id, (event, jobObj) => {
      if (
        event === 'DELETE' ||
        (jobObj.active_nodes.length === 0 && !jobObj.recursive)
      ) {
        statusEmitter.close();
        return;
      }

      jobObj.active_nodes.forEach(async (result, index) => {
        if (!processedIds.has(result.job)) {
          if (!init) {
            statusEmitter.emitCreate(result.job, result);
          }
          processedIds.add(result.job);
          await listenToJobUntilComplete(result.job, statusEmitter);

          jobObj.expired_nodes.push(result);
          jobObj.active_nodes.splice(index, 1);

          this.state.set(id, jobObj);
        }
      });

      init = false;
    });
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

    let runId: string;

    const recurisveLoop = async (
      market: string,
      job: JobDefinition,
      options: JobPostingOptions,
    ) => {
      const jobResult = await postJobWithOptions(
        market,
        job,
        options,
        ({ id, active_nodes }) => {
          const timeout = active_nodes[0].job_timeout;
          if (recursive) {
            this.workers.set(
              id,
              setTimeout(() => {
                recurisveLoop(market, job, options);
              }, recurisveTimeout(timeout, recursive_offset_min)),
            );
          }
        },
      );
      if (runId === undefined) runId = jobResult.id;
      this.state.set(runId, (e) => ({
        ...jobResult,
        ...e,
        active_nodes: [
          ...(e
            ? [...e.active_nodes, ...jobResult.active_nodes]
            : jobResult.active_nodes),
        ],
      }));
      return jobResult;
    };

    try {
      return await recurisveLoop(market, job, options);
    } catch (e) {
      throw new Error('Failed to post job');
    }
  }

  public get(id: string): JobObject | undefined {
    return this.state.get(id);
  }

  public list(): string[] {
    // @ts-ignore
    return this.state.list();
  }

  public async stop(id: string, waitForRunning = false): Promise<string[]> {
    await this.nosana.jobs.loadNosanaJobs();

    const localGroup = this.state.get(id);
    if (localGroup) {
      const worker = this.workers.get(id);
      if (worker) {
        clearTimeout(worker);
        this.workers.delete(id);
      }

      const failedJobs: string[] = [];

      await Promise.all(
        localGroup.active_nodes.map(async ({ job }) => {
          return new Promise(async (resolve) => {
            try {
              await stopJob(job, waitForRunning);
              resolve(true);
            } catch {
              failedJobs.push(job);
            }
          });
        }),
      );

      this.state.set(id, {
        ...localGroup,
        active_nodes: localGroup.active_nodes.filter(({ job }) =>
          failedJobs.includes(job),
        ),
        expired_nodes: [
          ...localGroup.expired_nodes,
          ...localGroup.active_nodes
            .filter(({ job }) => !failedJobs.includes(job))
            .map((job) => ({
              ...job,
              status: 'COMPLETED' as 'COMPLETED',
            })),
        ],
      });

      return failedJobs;
    } else {
      try {
        await stopJob(id, waitForRunning);
      } catch {
        return [id];
      }
    }

    return [];
  }

  public listen(port: number) {
    jobListener(port, this);
  }
}
