import { EventSource } from '../../../eventsource/index.js';
import { buildInfoObject, JobInfoResponse } from './buildInfoObject.js';
import { NodeRepository } from '../../../../../repository/NodeRepository.js';
import { TaskManagerRegistry } from '../../../../task/TaskManagerRegistry.js';

const INTERVAL_MS = 1000;

export function pollActiveJob(
  repository: NodeRepository,
  jobId: string,
  sendIfChanged: EventSource<JobInfoResponse>['sendIfChanged'],
  closeEventSource: EventSource<JobInfoResponse>['closeEventSource'],
) {
  let debounceTimer: NodeJS.Timeout | null = null;

  const stopPolling = () => {
    if (debounceTimer) clearInterval(debounceTimer);
    closeEventSource();
  };

  const initialFlowState = repository.getFlowState(jobId);
  const initialTask = TaskManagerRegistry.getInstance().get(jobId);

  if (!initialFlowState) {
    stopPolling();
    return {
      stopPolling,
    };
  }

  sendIfChanged(buildInfoObject(initialFlowState, initialTask));

  if (initialFlowState.endTime) {
    stopPolling();
    return {
      stopPolling,
    };
  }

  debounceTimer = setInterval(() => {
    const flowState = repository.getFlowState(jobId);
    const task = TaskManagerRegistry.getInstance().get(jobId);

    if (!flowState) {
      stopPolling();
      return;
    }

    sendIfChanged(buildInfoObject(flowState, task));

    if (flowState.endTime) {
      stopPolling();
      return;
    }
  }, INTERVAL_MS);

  return {
    stopPolling,
  };
}
