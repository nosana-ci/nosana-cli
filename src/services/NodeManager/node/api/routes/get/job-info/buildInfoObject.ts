import { FlowState, OpState } from '@nosana/sdk';
import TaskManager from '../../../../task/TaskManager.js';

type TaskStatus = Record<string, string | null>;
type RedactedFlowState = Omit<OpState, 'logs' | 'providerId'>;

type RedactedFlowStateWithOpStates = Omit<FlowState, 'opStates'> & {
  opStates: RedactedFlowState[];
};

type TaskResponse = {
  all: TaskStatus | null;
  currentGroup: string | undefined;
  currentGroupStatus: TaskStatus | null;
};

export type JobInfoResponse = RedactedFlowStateWithOpStates & {
  operations: TaskResponse | null;
};

export function buildInfoObject(
  flowState: FlowState,
  task: TaskManager | undefined,
): JobInfoResponse {
  const { opStates, ...flowStateWithoutOpStates } = flowState;

  return {
    ...flowStateWithoutOpStates,
    errors: flowState.errors ?? [],
    opStates: opStates.map(({ logs, providerId, ...opState }) => opState),
    operations: task
      ? {
          all: task.getOperationsStatus(),
          currentGroup: task.getCurrentGroup(),
          currentGroupStatus: task.getCurrentGroupStatus(),
        }
      : null,
  };

}
