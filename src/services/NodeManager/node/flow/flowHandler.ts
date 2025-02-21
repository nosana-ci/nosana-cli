import {
  Flow,
  JobDefinition,
  Operation,
  OperationArgsMap,
  OperationType,
  OpState,
} from '../../provider/types.js';
import { Provider } from '../../provider/Provider.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { abortControllerSelector } from '../abort/abortControllerSelector.js';

export class FlowHandler {
  constructor(private provider: Provider, private repository: NodeRepository) {
    applyLoggingProxyToClass(this);
  }

  public init(id: string): void {
    this.repository.setflow(id, this.createInitFlow(id));
  }

  public start(id: string, jobDefinition: JobDefinition): Flow {
    this.repository.setflow(id, this.createNewFlow(id, jobDefinition));

    for (let i = 0; i < jobDefinition.ops.length; i++) {
      this.repository.addOpstate(
        id,
        this.createOpNewState(jobDefinition.ops[i].id),
      );
    }

    return this.repository.getflow(id);
  }

  public resume(id: string): Flow {
    return this.repository.getflow(id);
  }

  public async run(id: string): Promise<Flow> {
    const flow = this.repository.getflow(id);

    for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
      const op = flow.jobDefinition.ops[i];
      const opState = this.repository.getOpState(id, i);

      if (opState.endTime || abortControllerSelector().signal.aborted) {
        continue;
      }

      try {
        if (
          !(await this.provider.runOperation(op.type, {
            id,
            index: i,
            name: this.repository.getFlowOperationName(id, i),
          }))
        ) {
          this.repository.updateflowState(id, {
            endTime: Date.now(),
            status: 'failed',
          });
          return this.repository.getflow(id);
        }
      } catch (error) {
        this.repository.updateflowStateError(id, error);
        this.repository.updateflowState(id, {
          endTime: Date.now(),
          status: 'failed',
        });
        return this.repository.getflow(id);
      }
    }

    try {
      for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
        const op = flow.jobDefinition.ops[i];

        try {
          await this.provider.stopOperation(op.type, {
            id,
            index: i,
            name: this.repository.getFlowOperationName(id, i),
          });
        } catch (_) {}
      }
    } catch (_) {}

    this.repository.updateflowState(id, {
      status: 'success',
      endTime: Date.now(),
    });

    return this.repository.getflow(id);
  }

  public async stopCurrentFlow() {
    await this.provider.finishCurrentRunningContainer();
  }

  public async stop(id: string): Promise<void> {
    const flow = this.repository.getflow(id);

    if (!flow) {
      return;
    }

    try {
      for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
        const op = flow.jobDefinition.ops[i];

        try {
          await this.provider.stopOperation(op.type, {
            id,
            index: i,
            name: this.repository.getFlowOperationName(id, i),
          });
        } catch (_) {}
      }
    } catch (_) {}

    this.repository.updateflowState(id, {
      endTime: Date.now(),
      status: 'stopped',
    });
  }

  private createInitFlow(id: string): Flow {
    return {
      id,
      jobDefinition: {
        version: '',
        type: 'container',
        ops: [],
      },
      state: {
        status: 'init',
        startTime: Date.now(),
        endTime: null,
        opStates: [],
        secrets: {},
      },
    };
  }

  private createNewFlow(id: string, jobDefinition: JobDefinition): Flow {
    return {
      id,
      jobDefinition,
      state: {
        status: 'running',
        startTime: Date.now(),
        endTime: null,
        opStates: [],
        secrets: {},
      },
    };
  }

  private createOpNewState(id: string): OpState {
    return {
      operationId: id,
      providerId: null,
      status: 'pending',
      startTime: null,
      endTime: null,
      exitCode: null,
      logs: [],
    };
  }

  public exposed(id: string): boolean {
    return this.repository
      .getflow(id)
      .jobDefinition.ops.some(
        (op: Operation<OperationType>) =>
          op.type === 'container/run' &&
          (op.args as OperationArgsMap['container/run']).expose !== undefined,
      );
  }

  public private(id: string): boolean {
    return this.repository
      .getflow(id)
      .jobDefinition.ops.some(
        (op: Operation<OperationType>) =>
          op.type === 'container/run' &&
          (op.args as OperationArgsMap['container/run']).expose !== undefined &&
          (op.args as OperationArgsMap['container/run']).private === true,
      );
  }

  public operationExposed(id: string): string {
    return this.repository.getFlowSecret(id, 'url') ?? 'private';
  }

  public async clearOldFlows(): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() - 3);

    for (const id in this.repository.getFlows()) {
      const flow = this.repository.getflow(id);
      if (flow.state.endTime && flow.state.endTime < date.valueOf()) {
        this.repository.deleteflow(id);
      }
    }
  }

  public generateRandomId(length: number): string {
    return [...Array(length)].map(() => Math.random().toString(36)[2]).join('');
  }
}
