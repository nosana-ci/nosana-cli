import chalk from 'chalk';
import { LowSync } from 'lowdb';
import { IValidation } from 'typia';
import { CronJob } from 'cron';

import {
  JobDefinition,
  Provider,
  OpState,
  Flow,
  FlowState,
  validateJobDefinition,
  Operation,
  OperationResults,
  ProviderEvents,
  OperationType,
} from './Provider.js';
import { sleep } from '../generic/utils.js';
import { DB } from './modules/db/index.js';
import Logger from './modules/logger/index.js';

export type NodeDb = {
  flows: { [key: string]: Flow };
  resources: Resources;
};

type Resources = {
  images: { [key: string]: ResourceHistory };
  volumes: { [key: string]: VolumeResource };
};

type ResourceHistory = {
  lastUsed: Date;
  usage: number;
  required: boolean;
};

type VolumeResource = ResourceHistory & {
  volume: string;
};

type OpFunction = (
  op: Operation<any>,
  flowId: string,
  updateOpState: (newOpStateData: Partial<FlowState>) => void,
  operationResults: OperationResults | undefined,
) => Promise<OpState>;

export class BasicProvider implements Provider {
  protected db: LowSync<NodeDb>;
  public name: string = 'basic';
  public logger: Logger;
  protected supportedOps: { [key: string]: OpFunction } = {};
  public clearFlowsCronJob: CronJob = new CronJob(
    '0 */12 * * *', // every 12 hours
    () => {
      this.clearOldFlows();
    },
    null,
    true, // start
  );

  constructor(configLocation: string, logger?: Logger) {
    this.db = new DB(configLocation).db;
    if (!logger) {
      this.logger = new Logger();
    } else {
      this.logger = logger;
    }
  }

  /**
   * Main run
   * @param jobDefinition
   * @param flowStateId
   * @returns
   */
  public run(jobDefinition: JobDefinition, flowId?: string): Flow {
    const id =
      flowId ||
      [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    let flow: Flow = this.db.data.flows[id];
    if (flow) {
      console.log(`Flow ${flowId} already exists, continuing that flow`);
    } else {
      // Create a new flow
      flow = {
        id,
        jobDefinition,
        state: {
          status: 'running',
          startTime: Date.now(),
          endTime: null,
          opStates: [],
        },
      };

      const validation: IValidation<JobDefinition> =
        validateJobDefinition(jobDefinition);
      if (!validation.success) {
        console.error(validation.errors);
        flow.state.status = 'failed';
        flow.state.endTime = Date.now();
        flow.state.errors = validation.errors;
        this.db.update(({ flows }) => (flows[id] = flow));
        return flow;
      }

      flow = this.hookPreRun(flow);
      // Add ops from job definition to flow
      for (let i = 0; i < jobDefinition.ops.length; i++) {
        const op = jobDefinition.ops[i];
        const opState: OpState = {
          operationId: op.id,
          providerId: null,
          status: 'pending',
          startTime: null,
          endTime: null,
          exitCode: null,
          logs: [],
        };
        flow.state.opStates.push(opState);
      }
      this.db.update(({ flows }) => (flows[id] = flow));
    }
    // Start running this flow
    this.runFlow(id);
    return flow;
  }

  public async continueFlow(flowId: string): Promise<Flow> {
    const flow: Flow | undefined = this.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} does not exist`);
    }
    // Start running this flow
    this.runFlow(flow.id);
    return flow;
  }

  protected hookPreRun(flow: Flow): Flow {
    // You can implement this hook if you want to change something to the
    // flow/job definition before running
    return flow;
  }
  /**
   * Run operations form job definition
   * @param jobDefinition
   * @param flowStateId
   */
  protected async runFlow(flowId: string): Promise<void> {
    const flow = this.db.data.flows[flowId];
    // Allow user to attach to events
    await sleep(0.1);
    this.logger.log(chalk.cyan(`Running flow ${chalk.bold(flowId)}`));
    try {
      // run operations
      let stopFlow: boolean = false;
      for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
        const op = flow.jobDefinition.ops[i];
        let opState: OpState = flow.state.opStates[i];
        if (!opState.endTime) {
          const updateOpState = (newOpStateData: Partial<OpState>) => {
            flow.state.opStates[i] = {
              ...flow.state.opStates[i],
              ...newOpStateData,
            };
            this.db.write();
            return flow.state.opStates[i];
          };
          try {
            const operationTypeFunction = this.supportedOps[op.type];
            if (!operationTypeFunction) {
              throw new Error(`no support for operation type ${op.type}`);
            }
            opState = await new Promise<OpState>(async (resolve, reject) => {
              // when flow is being stopped, resolve promise
              this.logger.on(ProviderEvents.STOP_FLOW, async (id) => {
                if (id === flowId) {
                  stopFlow = true;
                  // If after 30 second the stopFlowOperation call didn't
                  // stop the operation: forcefully stop
                  setTimeout(() => {
                    const opState = this.db.data.flows[
                      flowId
                    ].state.opStates.find(
                      (opState) => opState.operationId === op.id,
                    );
                    resolve(opState!);
                  }, 30000);

                  // This call should stop the operation, making sure
                  // `operationTypeFunction` returns within 30 seconds.
                  await this.stopFlowOperation(flowId, op);
                }
              });
              try {
                this.logger.log(
                  chalk.cyan(`Executing step ${chalk.bold(op.id)}`),
                );
                const finishedOpState = await operationTypeFunction(
                  op,
                  flowId,
                  updateOpState,
                  flow.jobDefinition.ops[i].results,
                );
                resolve(finishedOpState);
              } catch (error) {
                reject(error);
              }
            });
            this.logger.removeAllListeners(ProviderEvents.STOP_FLOW);
          } catch (error: any) {
            updateOpState({
              exitCode: 2,
              status: 'failed',
              endTime: Date.now(),
              logs: [
                {
                  type: 'nodeerr',
                  log: error.message ? error.message.toString() : error,
                },
              ],
            });
            this.db.data.flows[flowId].state.opStates.find(
              (opState) => opState.operationId === op.id,
            )!.status = 'failed';
            this.db.write();
            this.logger.removeAllListeners(ProviderEvents.STOP_FLOW);
            break;
          }
        }
        if (opState) {
          // Stop running when operation failed or when we stopped the flow
          if (opState.status === 'failed') break;
          else if (stopFlow) break;
        }
      }
    } catch (error: any) {
      if (!this.db.data.flows[flowId].state.errors) {
        this.db.data.flows[flowId].state.errors = [];
      }
      this.db.data.flows[flowId].state.errors?.push(error.toString());
      this.db.write();
    }
    this.finishFlow(
      flowId,
      flow && flow.state.errors && flow.state.errors.length > 0
        ? 'error'
        : undefined,
    );
  }

  /**
   * Check if BasicProvider is healthy. Providers should implement this themselve
   * @returns boolean
   */
  public async healthy(throwError: Boolean = true): Promise<Boolean> {
    return true;
  }

  public async updateMarketRequiredResources(_: string): Promise<void> {
    return new Promise(() => {
      throw new Error(
        'updateMarketRequiredResources is not implamented within the basic provider',
      );
    });
  }

  public async stopFlowOperation(
    flowId: string,
    op: Operation<OperationType>,
  ): Promise<OpState> {
    const opState = this.db.data.flows[flowId].state.opStates.find(
      (opState) => opState.operationId === op.id,
    );
    if (!opState) throw new Error('could not find opState');
    if (opState.status === 'running') {
      opState.status = 'stopped';
    }
    if (!opState.endTime) {
      opState.endTime = Date.now();
    }
    this.db.write();
    return opState;
  }

  /**
   * Wait for flow to be finished and return FlowState
   * @param id Flow id
   * @param logCallback
   * @returns FlowState
   */
  public async waitForFlowFinish(
    flowId: string,
    logCallback?: Function,
  ): Promise<FlowState | null> {
    return await new Promise((resolve, reject) => {
      const flow = this.db.data.flows[flowId];
      if (!flow) reject('Flow not found');
      if (this.db.data.flows[flowId].state.endTime) {
        resolve(this.db.data.flows[flowId].state);
      }

      if (logCallback) {
        this.logger.on(ProviderEvents.CONTAINER_LOG, (info) => {
          logCallback(info);
        });
      }

      this.logger.on(ProviderEvents.FLOW_FINISHED, (flow: Flow) => {
        this.logger.removeAllListeners(ProviderEvents.FLOW_FINISHED);
        this.logger.removeAllListeners(ProviderEvents.CONTAINER_LOG);
        resolve(flow ? flow.state : null);
      });
    });
  }

  /**
   * Finish a flow. Set status & emit end event
   * @param flowStateId
   */
  public finishFlow(flowId: string, status?: string) {
    const checkStatus = (op: OpState) => op.status === 'failed';
    const flow = this.db.data.flows[flowId];
    if (!flow) throw new Error(`Could not find flow ${flowId}`);

    if (status) {
      flow.state.status = status;
    } else {
      flow.state.status =
        flow.state.opStates.some(checkStatus) ||
        flow.state.opStates.every((opState) => !opState.status)
          ? 'failed'
          : 'success';
    }
    if (!flow.state.endTime) {
      flow.state.endTime = Date.now();
      this.db.write();
    }
    this.logger.emit(ProviderEvents.FLOW_FINISHED, flow);
  }

  public async clearFlow(flowId: string): Promise<void> {
    delete this.db.data.flows[flowId];
    this.db.write();
  }
  public async stopFlow(flowId: string): Promise<void> {
    this.logger.emit(ProviderEvents.STOP_FLOW, flowId);
  }

  public async clearOldFlows(): Promise<void> {
    // Remove flows from db where flow is ended more than 3 days ago
    const date = new Date();
    date.setDate(date.getDate() - 3);
    for (const flowId in this.db.data.flows) {
      const flow = this.db.data.flows[flowId];
      if (flow.state.endTime && flow.state.endTime < date.valueOf()) {
        await this.clearFlow(flowId);
      }
    }
  }

  /****************
   *   Getters   *
   ****************/
  public getFlow(id: string): Flow | undefined {
    return this.db.data.flows[id];
  }
}
