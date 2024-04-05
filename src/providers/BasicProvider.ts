import chalk from 'chalk';
import {
  JobDefinition,
  Provider,
  OpState,
  Flow,
  FlowState,
  validateJobDefinition,
  Operation,
} from './Provider.js';
import fs from 'fs';
import os from 'os';
import { JSONFileSyncPreset } from 'lowdb/node';
import { LowSync } from 'lowdb/lib';
import EventEmitter from 'events';
import { IValidation } from 'typia';

type FlowsDb = {
  flows: { [key: string]: Flow };
};

type OpFunction = (
  op: Operation<any>,
  flowId: string,
  updateOpState: (newOpStateData: Partial<FlowState>) => void,
) => Promise<OpState>;

export class BasicProvider implements Provider {
  protected db: LowSync<FlowsDb>;
  protected eventEmitter: EventEmitter = new EventEmitter();
  protected supportedOps: { [key: string]: OpFunction } = {};

  constructor(configLocation: string) {
    // Create or read database
    if (configLocation && configLocation[0] === '~') {
      configLocation = configLocation.replace('~', os.homedir());
    }
    fs.mkdirSync(configLocation, { recursive: true });
    this.db = JSONFileSyncPreset<FlowsDb>(`${configLocation}/flows.json`, {
      flows: {},
    });

    // Remove flows from db where flow is ended more than 3 days ago
    const date = new Date();
    date.setDate(date.getDate() - 3);
    this.db.data.flows = Object.entries(this.db.data.flows).reduce(
      (flow: any, [key, value]) => {
        if (value.state.endTime && value.state.endTime > date.valueOf()) {
          flow[key] = value;
        } else if (!value.state.endTime) {
          flow[key] = value;
        }
        return flow;
      },
      {},
    );
    this.db.write();
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

  /**
   * Run operations form job definition
   * @param jobDefinition
   * @param flowStateId
   */
  protected async runFlow(flowId: string): Promise<void> {
    console.log(chalk.cyan(`Running flow ${chalk.bold(flowId)}`));
    const flow = this.db.data.flows[flowId];
    try {
      // run operations
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
              this.eventEmitter.on('startStopFlow', (id) => {
                if (id === flowId) {
                  const stoppedOpState = updateOpState({
                    status: 'stopped',
                    endTime: Date.now(),
                  });
                  resolve(stoppedOpState);
                }
              });
              try {
                const finishedOpState = await operationTypeFunction(
                  op,
                  flowId,
                  updateOpState,
                );
                resolve(finishedOpState);
              } catch (error) {
                reject(error);
              }
            });
            this.eventEmitter.removeAllListeners('startStopFlow');
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
            break;
          }
        }
        if (opState) {
          // Stop running when operation failed or when we stopped the operation
          if (opState.status === 'failed') break;
          else if (opState.status === 'stopped') break;
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
        this.eventEmitter.on('newLog', (info) => {
          logCallback(info);
        });
      }

      this.eventEmitter.on('flowFinished', (flow: Flow) => {
        this.eventEmitter.removeAllListeners('flowFinished');
        this.eventEmitter.removeAllListeners('newLog');
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
    flow.state.endTime = Date.now();
    this.db.write();
    this.eventEmitter.emit('flowFinished', flow);
  }

  public async clearFlow(flowId: string): Promise<void> {
    delete this.db.data.flows[flowId];
    this.db.write();
  }
  public async stopFlow(flowId: string): Promise<void> {
    this.eventEmitter.emit('startStopFlow', flowId);
  }

  /****************
   *   Getters   *
   ****************/
  public getFlow(id: string): Flow | undefined {
    return this.db.data.flows[id];
  }
}
