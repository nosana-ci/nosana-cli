import { postJobWithOptions } from './actions/post/index.js';
import { jobListener } from './listener/index.js';
import { JobObject, JobPostingOptions } from './listener/types/index.js';
import { JobDefinition } from '../../providers/Provider.js';
import { JobManagerState } from './state/index.js';
import { DEFAULT_OFFSET_SEC } from './definitions/index.js';
import { Client } from '@nosana/sdk';
import { getSDK } from '../sdk.js';
import { createSignature } from '../api.js';
import { listenToEventSource } from '../eventsource.js';
import { config } from '../../generic/config.js';
import { waitForJobCompletion, waitForJobRunOrCompletion } from '../jobs.js';
import { PublicKey } from '@solana/web3.js';
import EventEmitter from 'events';

export default class JobManager {
  public state: JobManagerState;
  private nosana: Client;
  private workers: Map<string, NodeJS.Timeout>;

  constructor(config: string) {
    this.state = new JobManagerState(config);
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

  public async createStatusListener(id: string): Promise<EventEmitter> {
    await this.nosana.jobs.loadNosanaJobs();

    const emitter = new EventEmitter();

    const jobState = this.state.get(id);

    if (!jobState) {
      throw new Error('Failed to find job');
    }

    const createListener = async (nodeAddress: string, jobAddress: string) => {
      console.log('CREATING LISTENER');
      const headers = await createSignature();
      const listener = listenToEventSource(
        `https://${nodeAddress}.${config.frp.serverAddr}/status/${jobAddress}`,
        headers,
        (events) => {
          console.log(events);
        },
      );
    };

    jobState.active_nodes.forEach(async (obj, index) => {
      const id = new PublicKey(obj.job);
      const { node, state } = await this.nosana.jobs.get(id);

      emitter.emit('message', {
        event: 'status_init',
        job_id: obj.job,
        status: state,
        node: node === '11111111111111111111111111111111' ? undefined : node,
      });

      if (['COMPLETE', 'STOPPED'].includes(`${state}`)) {
        jobState.expired_nodes.push(obj);
        jobState.active_nodes.splice(index, 1);
        return;
      }

      const { node: currentNode, state: currentState } =
        await waitForJobRunOrCompletion(id);

      console.log('Running');

      if (currentState === 'RUNNING') {
        if (state !== currentState) {
          emitter.emit('message', {
            event: 'status_update',
            job_id: obj.job,
            status: currentState,
            node: currentNode,
          });
        }
        // createListener(node, obj.job);
      }

      const { node: finalNode, state: finalState } = await waitForJobCompletion(
        id,
      );
      emitter.emit('message', {
        event: 'status_update',
        job_id: obj.job,
        status: finalState,
        node: finalNode,
      });
    });

    if (jobState.active_nodes.length === 0) {
      throw new Error('No active jobs');
    }

    return emitter;
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
