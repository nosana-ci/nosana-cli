import EventEmitter from 'events';
import { Client } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';

import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import {
  JobObject,
  JobPostingOptions,
  JobResult,
} from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';
import { DEFAULT_OFFSET_SEC } from './definitions/index.js';
import { getSDK } from '../sdk.js';
import { createSignature } from '../api.js';
import { listenToEventSource } from '../eventsource.js';
import { config } from '../../generic/config.js';
import { waitForJobCompletion, waitForJobRunOrCompletion } from '../jobs.js';
import { StatusEmitter } from './actions/status/statusEmitter.js';

export default class JobManager {
  public state: JobManagerState;
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

  // TODO: Listen to state for recurisve posting
  // TODO: Stop send close event when all jobs are complete
  // TODO: Listen to node status
  // TODO: Refactor

  // { event: PULLING_IMAGE, image_name: "ubunutu" }
  // { event: PULLING_COMPLETE }

  public async status(
    id: string,
    onEvent: (msg: {}) => void,
    onClose: () => void,
  ) {
    await this.nosana.jobs.loadNosanaJobs();

    const processedIds = new Set<string>();
    const statusEmitter = new StatusEmitter();

    statusEmitter.on('event', onEvent);
    statusEmitter.on('close', onClose);

    this.state.subscribe(id, (event, jobObj) => {
      console.log({ length: jobObj.active_nodes.length });
      console.log({ nodes: jobObj.active_nodes });
      if (event === 'DELETE' || jobObj.active_nodes.length === 0) {
        statusEmitter.close();
        return;
      }

      jobObj.active_nodes.forEach(async (result, index) => {
        if (!processedIds.has(result.job)) {
          processedIds.add(result.job);
          await this.listenToJobUntilComplete(result.job, statusEmitter);

          jobObj.expired_nodes.push(result);
          jobObj.active_nodes.splice(index, 1);

          this.state.set(id, jobObj);
        }
      });
    });
  }

  private createListener = async (nodeAddress: string, jobAddress: string) => {
    const headers = await createSignature();
    const listener = listenToEventSource(
      `https://${nodeAddress}.${config.frp.serverAddr}/status/${jobAddress}`,
      headers,
      (events) => {
        console.log(events);
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
        // this.createListener(node, jobId);
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
