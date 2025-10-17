import { EventSource } from '../../../eventsource/index.js';
import { buildInfoObject, JobInfoResponse } from './buildInfoObject';
import { NodeRepository } from '../../../../../repository/NodeRepository';
import { TaskManagerRegistry } from '../../../../task/TaskManagerRegistry';

const INTERVAL_MS = 1000;

export function pollActiveJob(
  repository: NodeRepository,
  jobId: string,
  sendIfChanged: EventSource<JobInfoResponse>['sendIfChanged'],
  closeEventSource: EventSource<JobInfoResponse>['closeEventSource'],
) {
  let debounceTimer: NodeJS.Timeout = setInterval(() => {
    const flowState = repository.getFlowState(jobId);
    const task = TaskManagerRegistry.getInstance().get(jobId);

    // Job might have been deleted, stop polling
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

  const stopPolling = () => {
    clearInterval(debounceTimer);
    closeEventSource();
  };

  return {
    stopPolling,
  };
}
