import { OperationType, Operation } from '@nosana/sdk';

export function createDefaultOpState(op: Operation<OperationType>) {
  return {
    operationId: op.id,
    group: op.execution?.group ?? op.id,
    providerId: null,
    status: 'init',
    startTime: null,
    endTime: null,
    exitCode: null,
    logs: [],
  };
}
