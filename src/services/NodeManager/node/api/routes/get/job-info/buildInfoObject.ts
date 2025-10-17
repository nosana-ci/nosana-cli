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

  /**
   * NEED TO WORK OUT WHAT TO DO WITH THE BELOW!!!!!!!
   */

  //   const secrets = flowData.state.secrets;
  //   if (secrets && secrets[jobId]) {
  //     const sdk = getSDK();
  //     const nodeState = state(sdk.solana.provider!.wallet.publicKey.toString());

  // const exposeIdToOpMap: Map<
  //   string,
  //   { opId: string; hasHealthChecks: boolean }
  // > = new Map();

  // if (flowData.jobDefinition && flowData.jobDefinition.ops) {
  //   flowData.jobDefinition.ops.forEach((op: any, index: number) => {
  //     if (isOpExposed(op as Operation<'container/run'>)) {
  //       const exposePorts = getExposePorts(
  //         op as Operation<'container/run'>,
  //       );
  //       exposePorts.forEach((exposedPort) => {
  //         const exposeId = getExposeIdHash(jobId, index, exposedPort.port);
  //         const hasHealthChecks =
  //           exposedPort.health_checks &&
  //           exposedPort.health_checks.length > 0;
  //         exposeIdToOpMap.set(exposeId, {
  //           opId: op.id,
  //           hasHealthChecks: !!hasHealthChecks,
  //         });
  //       });
  //     }
  //   });
  // }

  //     const enhancedUrls: Record<string, any> = {};
  //     const urlsData = secrets[jobId];

  //     for (const [exposeId, urlData] of Object.entries(urlsData)) {
  //       const opMapping = exposeIdToOpMap.get(exposeId);
  //       if (!opMapping) continue;

  //       const { opId, hasHealthChecks } = opMapping;
  //       let endpointStatus = 'OFFLINE';

  //       const opStatus = task?.getOperationStatus(opId)?.[opId];
  //       const isOpRunning = opStatus === 'running';

  //       if (isOpRunning) {
  //         if (hasHealthChecks) {
  //           if (
  //             nodeState?.shared?.job === jobId &&
  //             nodeState?.shared?.serviceUrlReady
  //           ) {
  //             endpointStatus = 'ONLINE';
  //           } else {
  //             endpointStatus = 'OFFLINE';
  //           }
  //         } else {
  //           endpointStatus = 'UNKNOWN';
  //         }
  //       }

  //       enhancedUrls[exposeId] = {
  //         opId,
  //         ...(typeof urlData === 'object' && urlData !== null ? urlData : {}),
  //         status: endpointStatus,
  //       };
  //     }

  //     response.endpoints = {
  //       urls: enhancedUrls,
  //     };
  //   }
}
