import EventEmitter from 'events';
import { IValidation } from 'typia';
import { PublicKey } from '@solana/web3.js';
import { FlowState, Job, Run, Client as SDK } from '@nosana/sdk';
import { JobDefinition, validateJobDefinition } from '../../provider/types.js';
import { Provider } from '../../provider/Provider.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { JobExternalUtil } from './jobExternalUtil.js';
import { abortControllerSelector } from '../abort/abortControllerSelector.js';
import { TaskManagerRegistry } from '../task/TaskManagerRegistry.js';
import TaskManager, { StopReason, StopReasons } from '../task/TaskManager.js';
import JobManager from '../../../JobManager/index.js';
import { JobRegistry } from './JobRegistry.js';

export const jobEmitter = new EventEmitter();

export class JobHandler {
  private id: string | undefined;
  private job: Job | undefined;
  private runSubscriptionId: number | undefined;

  private jobExternalUtil: JobExternalUtil;

  private eventEmitter: EventEmitter;

  private finishing: boolean = false;

  public accountEmitter: EventEmitter;

  constructor(
    private sdk: SDK,
    private provider: Provider,
    private repository: NodeRepository,
  ) {
    this.jobExternalUtil = new JobExternalUtil(sdk, this.repository);

    applyLoggingProxyToClass(this);

    this.eventEmitter = new EventEmitter();
    this.accountEmitter = new EventEmitter();

    jobEmitter.on('run-exposed', (data) => {
      // this.flowHandler.operationExposed(data, undefined);
    });

    jobEmitter.on('startup-success', (data) => {
      // this.flowHandler.operationExposed(data, true);
    });

    jobEmitter.on('continuous-failure', (data) => {
      // this.flowHandler.operationExposed(data, false);
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

  register(jobAddress: string, run: Run, job: Job) {
    JobRegistry.getInstance().register(jobAddress, run, job)
  }

  deregister(jobAddress: string) {
    JobRegistry.getInstance().remove(jobAddress)
  }
  
  async nodeStop(): Promise<void> {
    await TaskManagerRegistry.getInstance().stop()
    await JobRegistry.getInstance().stop(this.sdk, this.repository)

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
      const jobDefinition: JobDefinition | null = await Promise.race([
        this.jobExternalUtil.resolveJobDefinition(this.jobId(), job),
        new Promise<JobDefinition | null>((resolve) =>
          abortControllerSelector().signal.addEventListener('abort', () =>
            resolve(null),
          ),
        ),
      ]);

      if (!jobDefinition) {
        return false;
      }

      if (!(await this.jobExternalUtil.validate(this.jobId(), jobDefinition))) {
        return false;
      }

      try {
        TaskManagerRegistry.getInstance().register(
          this.jobId(),
          new TaskManager(
            this.provider,
            this.repository,
            this.jobId(),
            jobDefinition,
          )
        )

        const task = TaskManagerRegistry.getInstance().get(this.jobId()) as TaskManager
        task.bootstrap()

      } catch (error) {
        this.repository.updateflowStateError(this.jobId(), {
          status: 'init error',
          errors: error,
        });

        TaskManagerRegistry.getInstance().remove(this.jobId())

        return false
      }
    } else {

      try {
        TaskManagerRegistry.getInstance().register(
          this.jobId(),
          new TaskManager(
            this.provider,
            this.repository,
            this.jobId()
          )
        )

        const task = TaskManagerRegistry.getInstance().get(this.jobId()) as TaskManager
        task.bootstrap()

      } catch (error) {
        this.repository.updateflowStateError(this.jobId(), {
          status: 'init error',
          errors: error,
        });

        TaskManagerRegistry.getInstance().remove(this.jobId())

        return false
      }
    }

    this.listenForAccountChanges();

    return true;
  }

  async runWithErrorHandling(): Promise<void> {
    const task = TaskManagerRegistry.getInstance().get(this.jobId()) as TaskManager
    await task.start()
    TaskManagerRegistry.getInstance().remove(this.jobId())
    this.accountEmitter.emit('completed');
  }

  async finish(run: Run, reason: StopReason): Promise<void> {
    try {
      const jobId = this.jobId();
      
      let result = await this.jobExternalUtil.resolveResult(
        jobId,
        this.get() as Job,
      );

      const ipfsResult = await this.sdk.ipfs.pin(result as object);
      const bytesArray = this.sdk.ipfs.IpfsHashToByteArray(ipfsResult);

      if (reason == StopReasons.STOPPED) {
        await this.sdk.jobs.complete(bytesArray, jobId);
      } else {
        await this.sdk.jobs.submitResult(
          bytesArray,
          run,
          this.getJobOrThrow().market.toString(),
        );
      }
    } catch (e) {
      throw new Error(`Failed to finish job: ${e}`);
    }
  }

  async clearOldJobs(): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() - 1);

    for (const id in this.repository.getFlows()) {
      const flow = this.repository.getflow(id);
      if (flow.state.endTime && flow.state.endTime < date.valueOf()) {
        this.repository.deleteflow(id);
      }
    }
  }
}
