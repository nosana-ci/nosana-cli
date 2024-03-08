import chalk from 'chalk';
import { JobDefinition, Provider, OpState, Flow, FlowState } from './Provider';
import { JSONFileSyncPreset } from 'lowdb/node';
import { LowSync } from 'lowdb/lib';
import EventEmitter from 'events';

type FlowsDb = {
  flows: { [key: string]: Flow };
};

export class BasicProvider implements Provider {
  protected db: LowSync<FlowsDb>;
  protected eventEmitter: EventEmitter = new EventEmitter();
  protected supportedOps: { [key: string]: string } = {};

  constructor() {
    // Create or read database
    this.db = JSONFileSyncPreset<FlowsDb>('db/flows.json', {
      flows: {},
    });
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
        let opState: OpState;
        try {
          const operationTypeFunction = this.supportedOps[op.type];
          if (!operationTypeFunction) {
            throw new Error(`no support for operation type ${op.type}`);
          }
          // @ts-ignore
          opState = await this[operationTypeFunction](op, flowId);
        } catch (error) {
          console.error(chalk.red(error));
          this.db.data.flows[flowId].state.opStates.find(
            (opState) => opState.operationId === op.id,
          )!.status = 'failed';
          this.db.write();
          break;
        }
        if (opState && opState.status === 'failed') break;
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
      flow.state.errors && flow.state.errors.length > 0
        ? 'node-error'
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
  ): Promise<FlowState> {
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

      this.eventEmitter.on('flowFinished', (flowId) => {
        this.eventEmitter.removeAllListeners('flowFinished');
        this.eventEmitter.removeAllListeners('newLog');
        resolve(this.db.data.flows[flowId].state);
      });
    });
  }

  /**
   * Finish a flow. Set status & emit end event
   * @param flowStateId
   */
  protected finishFlow(flowId: string, status?: string) {
    const checkStatus = (op: OpState) => op.status === 'failed';
    if (status) {
      this.db.data.flows[flowId].state.status = status;
    } else {
      this.db.data.flows[flowId].state.status =
        this.db.data.flows[flowId].state.opStates.some(checkStatus) ||
        this.db.data.flows[flowId].state.opStates.every(
          (opState) => !opState.status,
        )
          ? 'failed'
          : 'success';
    }
    this.db.data.flows[flowId].state.endTime = Date.now();
    this.db.write();

    this.eventEmitter.emit('flowFinished', flowId);
    console.log(`Finished flow ${flowId} \n`);
  }

  public async clearFlow(flowId: string): Promise<void> {
    delete this.db.data.flows[flowId];
    this.db.write();
    console.log('Cleared flow', flowId);
  }

  /****************
   *   Getters   *
   ****************/
  public getFlow(id: string): Flow | undefined {
    return this.db.data.flows[id];
  }
}
