import type { OperationType, Operation } from '@nosana/sdk';

import type { OpStateWithError } from '../../../repository/NodeRepository.js';

export function createDefaultOpState(
  op: Operation<OperationType>,
): OpStateWithError {
  return {
    operationId: op.id,
    group: op.execution?.group ?? op.id,
    providerId: null,
    status: 'init',
    startTime: null,
    endTime: null,
    exitCode: null,
    logs: [],
    error: [], // Add error array
  };
}
