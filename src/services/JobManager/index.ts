import { Client, sleep } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';

import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import { JobObject, JobPostingOptions } from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';
import { getSDK } from '../sdk.js';
import { createSignature } from '../api.js';
import { listenToEventSource } from '../eventsource.js';
import { config } from '../../generic/config.js';
import { waitForJobCompletion, waitForJobRunOrCompletion } from '../jobs.js';
import { StatusEmitter } from './actions/status/statusEmitter.js';
import { recurisveTimeout } from './actions/post/helpers/getRecursiveTimeout.js';

export default class JobManager {
  protected state: JobManagerState;
  private nosana: Client;
  private workers: Map<string, NodeJS.Timeout>;

  constructor(configPath: string) {
    this.state = new JobManagerState(configPath);
    this.nosana = getSDK();
    this.workers = new Map();
  }

  public stop(job: string): string | Error {
    if (!this.workers.has(job)) {
      return new Error('Failed to find job');
    }

    clearTimeout(this.workers.get(job));
    return job;
  }

  // TODO: Listen to node status
  // TODO: Listen for recursive stop

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
          await this.listenToJobUntilComplete(result.job, statusEmitter);

          jobObj.expired_nodes.push(result);
          jobObj.active_nodes.splice(index, 1);

          this.state.set(id, jobObj);
        }
      });

      init = false;
    });
  }

  private createListener = async (
    nodeAddress: string,
    jobAddress: string,
    statusEmitter: StatusEmitter,
  ) => {
    // TODO: update node addresss from 1111111111111111111111
    let listener;
    await sleep(3);
    const headers = await createSignature();
    listener = listenToEventSource(
      `https://${nodeAddress}.${config.frp.serverAddr}/status/${jobAddress}?logs=jobLog`,
      headers,
      (events: any[]) => {
        if (events.length > 0) {
          events.forEach(({ log }) => {
            const streamableLogs = [
              'JOB_DEFINATION_VALIDATION',
              'JOB_DEFINATION_VALIDATION_PASSED',
              'PULLING_IMAGE',
              'PULLING_IMAGE_SUCCESS',
              'CONTAINER_STARTING',
              'CONTAINER_STARTED',
            ];
            const logJSON = JSON.parse(log);
            if (streamableLogs.includes(logJSON.state)) {
              statusEmitter.emitProgress(jobAddress, logJSON.state);
            }

            if (logJSON.state === 'FLOW_FINISHED') {
              listener!.close();
            }
          });
        }
      },
    );
  };

  private async listenToJobUntilComplete(
    jobId: string,
    statusEmitter: StatusEmitter,
  ) {
    return new Promise(async (resolve) => {
      const id = new PublicKey(jobId);
      const { node, state } = await this.nosana.jobs.get(id);

      statusEmitter.emitStatus(jobId, node, state);

      if (['COMPLETED', 'STOPPED'].includes(`${state}`)) {
        resolve(true);
      }

      const { node: runNode, state: runState } =
        await waitForJobRunOrCompletion(id);

      if (runState === 'RUNNING') {
        if (state !== runState) {
          statusEmitter.emitStatus(jobId, runNode, runState);
        }
        this.createListener(node, jobId, statusEmitter);
      }

      const { node: finalNode, state: finalState } = await waitForJobCompletion(
        id,
      );

      statusEmitter.emitStatus(jobId, finalNode, finalState);
      resolve(true);
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
        ({ active_nodes }) => {
          const timeout = active_nodes[0].job_timeout;
          if (recursive) {
            setTimeout(() => {
              recurisveLoop(market, job, options);
            }, recurisveTimeout(timeout, recursive_offset_min));
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

  public listen(port: number) {
    jobListener(port, this);
  }
}
