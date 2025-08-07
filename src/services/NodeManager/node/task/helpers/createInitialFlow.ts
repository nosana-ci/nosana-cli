import { Flow, JobDefinition, Operation, OperationType } from '@nosana/sdk';
import { createDefaultOpState } from './createDefaultOpState.js';

/**
 * Creates the initial flow structure for a given job.
 *
 * This sets up the default flow object with placeholder metadata and default op states.
 */
export function createInitialFlow(
  jobId: string,
  definition: JobDefinition,
  operations: Operation<OperationType>[],
  status: string,
  timestamp: number,
): Flow {
  return {
    id: jobId,
    jobDefinition: definition,
    state: {
      status,
      startTime: timestamp,
      endTime: null,
      secrets: {},
      opStates: operations.map(createDefaultOpState),
    },
  };
}
