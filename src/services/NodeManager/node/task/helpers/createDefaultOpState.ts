import type { OperationType, Operation, OpState } from '@nosana/sdk';

export function createDefaultOpState(op: Operation<OperationType>): OpState {
  return {
    operationId: op.id,
    group: op.execution?.group ?? op.id,
    providerId: null,
    status: 'init',
    startTime: null,
    endTime: null,
    exitCode: null,
    logs: [],
    errors: [],
    diagnostics: {
      reason: {
        hostShutDown: false,
        jobStopped: false,
        jobExpired: false,
      },
    },
  };
}
