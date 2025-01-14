import EventEmitter from 'events';
import { IValidation } from 'typia';
import { PublicKey } from '@solana/web3.js';
import { Job, Run, Client as SDK } from '@nosana/sdk';

import { JobDefinition } from '../../provider/types.js';
import { FlowHandler } from '../flow/flowHandler.js';
import { Provider } from '../../provider/Provider.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { validateJobDefinition } from '../../../../providers/Provider.js';
import { JobExternalUtil } from './jobExternalUtil.js';

export const jobEmitter = new EventEmitter();

export class JobHandler {
  private id: string | undefined;
  private job: Job | undefined;
  private runSubscriptionId: number | undefined;

  private flowHandler: FlowHandler;
  private jobExternalUtil: JobExternalUtil;

  private eventEmitter: EventEmitter;

  private finishing: boolean = false;

  public accountEmitter: EventEmitter;

  constructor(
    private sdk: SDK,
    private provider: Provider,
    private repository: NodeRepository,
  ) {
    this.flowHandler = new FlowHandler(this.provider, repository);
    this.jobExternalUtil = new JobExternalUtil(sdk, this.repository);

    applyLoggingProxyToClass(this);

    this.eventEmitter = new EventEmitter();
    this.accountEmitter = new EventEmitter();

    jobEmitter.on('run-exposed', (data) => {
      this.flowHandler.operationExposed(data.id);
    });
  }

  /**
   * Expose a method to allow external consumers to listen for events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Expose a method to remove listeners
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  public get(): Job | undefined {
    return this.job;
  }

  private jobId(): string {
    if (!this.id) {
      throw new Error('Job ID is not set');
    }
    return this.id;
  }

  private getJobOrThrow(): Job {
    if (!this.job) {
      throw new Error('Job is not set');
    }
    return this.job;
  }

  public clearJob() {
    this.job = undefined;
  }

  async claim(jobAddress: string): Promise<Job> {
    try {
      const job: Job = await this.sdk.jobs.get(jobAddress);
      this.id = jobAddress;
      this.job = job;
      return job;
    } catch (_) {
      throw new Error('could not start job');
    }
  }

  async stop(): Promise<void> {
    if (this.id) {
      await this.flowHandler.stop(this.jobId());
    }

    this.stopListeningForAccountChanges();
    this.clearJob();
  }

  async validate(jobDefinition: JobDefinition): Promise<boolean> {
    const validation: IValidation<JobDefinition> =
      validateJobDefinition(jobDefinition);

    if (!validation.success) {
      this.repository.updateflowStateError(this.jobId(), {
        status: 'validation-error',
        errors: validation.errors,
      });
      return false;
    }

    return true;
  }

  private listenForAccountChanges() {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await this.sdk.jobs.loadNosanaJobs();
        this.runSubscriptionId = this.sdk.jobs.connection!.onAccountChange(
          new PublicKey(this.jobId()),
          (accountInfo) => {
            const jobAccount = this.sdk.jobs.jobs!.coder.accounts.decode(
              this.sdk.jobs.jobs!.account.jobAccount.idlAccount.name,
              accountInfo.data,
            ) as Job;

            if ((jobAccount.state as number) >= 2) {
              this.accountEmitter.emit('stopped', jobAccount);
              resolve();
              return;
            }

            this.accountEmitter.emit('changed', jobAccount);
          },
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  private stopListeningForAccountChanges() {
    if (this.runSubscriptionId !== undefined) {
      this.sdk.jobs.connection!.removeProgramAccountChangeListener(
        this.runSubscriptionId,
      );
      this.runSubscriptionId = undefined;
    }
  }

  async start(job: Job): Promise<boolean> {
    const flow = this.repository.getflow(this.jobId());

    if (!flow) {
      this.flowHandler.init(this.jobId());

      let jobDefinition: JobDefinition =
        await this.jobExternalUtil.resolveJobDefinition(this.jobId(), job);

      if (!(await this.jobExternalUtil.validate(this.jobId(), jobDefinition))) {
        return false;
      }

      this.flowHandler.start(this.jobId(), jobDefinition);
    } else {
      this.flowHandler.resume(this.jobId());
    }

    this.listenForAccountChanges();

    return true;
  }

  async run(): Promise<boolean> {
    try {
      if (this.repository.getFlowState(this.jobId()).status == 'failed') {
        return false;
      }

      await this.flowHandler.run(this.jobId());

      if (this.repository.getFlowState(this.jobId()).status == 'failed') {
        return false;
      }

      return true;
    } catch (error) {
      this.eventEmitter.emit('error', error);
      return false;
    }
  }

  async runWithErrorHandling(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const errorHandler = (error: Error) => {
        this.off('error', errorHandler);
        reject(error);
      };

      this.on('error', errorHandler);

      this.run()
        .then(() => {
          this.off('error', errorHandler);
          resolve();
        })
        .catch((error) => {
          this.off('error', errorHandler);
          reject(error);
        });
    });
  }

  async stopCurrentJob(): Promise<void> {
    await this.flowHandler.stopCurrentFlow();
  }

  async quit(run: Run): Promise<void> {
    await this.sdk.jobs.quit(run);
    await this.flowHandler.stop(this.jobId());
  }

  exposed(): boolean {
    return this.flowHandler.exposed(this.jobId());
  }

  async finish(run: Run): Promise<void> {
    if (!this.repository.getflow(this.jobId())) {
      return;
    }

    try {
      let result = await this.jobExternalUtil.resolveResult(this.jobId());
      const ipfsResult = await this.sdk.ipfs.pin(result as object);
      const bytesArray = this.sdk.ipfs.IpfsHashToByteArray(ipfsResult);

      await this.sdk.jobs.submitResult(
        bytesArray,
        run,
        this.getJobOrThrow().market.toString(),
      );
    } catch (e) {
      throw new Error(`Failed to finish job: ${e}`);
    }
  }

  async clearOldJobs(): Promise<void> {
    await this.flowHandler.clearOldFlows();
  }
}
