import { Response } from 'express';
import {
  getExposeIdHash,
  getExposePorts,
  isOpExposed,
  Operation,
} from '@nosana/sdk';

import { NodeAPIRequest } from '../../types/index.js';
import { TaskManagerRegistry } from '../../../task/TaskManagerRegistry.js';
import { getSDK } from '../../../../../sdk.js';
import { state } from '../../../../monitoring/state/NodeState.js';

/**
 * SSE endpoint for real-time job information streaming.
 */
export function getJobInfoRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const jobId = req.params.jobId;

  if (!jobId) {
    return res.status(400).send('job id parameter not provided');
  }

  const flow = req.repository!.getFlow(jobId);

  if (!flow) {
    return res.status(400).send('invalid job id');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let lastSentData: string | null = null;

  const sendJobInfoIfChanged = () => {
    try {
      const currentFlow = req.repository!.getFlow(jobId);
      if (!currentFlow) {
        console.error('Flow not found:', jobId);
        return;
      }
      
      const task = TaskManagerRegistry.getInstance().get(jobId);
      const response: any = buildJobInfoResponse(currentFlow, task);
      
      const currentData = JSON.stringify(response);
      
      if (currentData !== lastSentData) {
        res.write(`data: ${currentData}\n\n`);
        lastSentData = currentData;
      }
    } catch (error: any) {
      console.error('Error building job info:', error);
    }
  };

  const buildJobInfoResponse = (flowData: any, task: any) => {
    const response: any = {
      jobId,
      status: flowData.state.status,
      startTime: flowData.state.startTime,
      endTime: flowData.state.endTime,
      project: flowData.project,
    };

    if (flowData.state.errors && flowData.state.errors.length > 0) {
      response.errors = flowData.state.errors;
    }

    if (flowData.state.status !== 'waiting-for-job-definition') {
      response.jobDefinition = flowData.jobDefinition;
    }

    if (task) {
      response.operations = {
        all: task.getOperationsStatus(),
        currentGroup: task.getCurrentGroup(),
        currentGroupStatus: task.getCurrentGroupStatus(),
        opStates: flowData.state.opStates.map((opState: any) => ({
          operationId: opState.operationId,
          status: opState.status,
          startTime: opState.startTime,
          endTime: opState.endTime,
          exitCode: opState.exitCode,
        })),
      };
    } else {
      response.operations = {
        opStates: flowData.state.opStates.map((opState: any) => ({
          operationId: opState.operationId,
          status: opState.status,
          startTime: opState.startTime,
          endTime: opState.endTime,
          exitCode: opState.exitCode,
        })),
      };
    }

    const secrets = flowData.state.secrets;
    if (secrets && secrets[jobId]) {
      const sdk = getSDK();
      const nodeState = state(
        sdk.solana.provider!.wallet.publicKey.toString(),
      );

      const exposeIdToOpMap: Map<
        string,
        { opId: string; hasHealthChecks: boolean }
      > = new Map();

      if (flowData.jobDefinition && flowData.jobDefinition.ops) {
        flowData.jobDefinition.ops.forEach((op: any, index: number) => {
          if (isOpExposed(op as Operation<'container/run'>)) {
            const exposePorts = getExposePorts(
              op as Operation<'container/run'>,
            );
            exposePorts.forEach((exposedPort) => {
              const exposeId = getExposeIdHash(jobId, index, exposedPort.port);
              const hasHealthChecks =
                exposedPort.health_checks &&
                exposedPort.health_checks.length > 0;
              exposeIdToOpMap.set(exposeId, {
                opId: op.id,
                hasHealthChecks: !!hasHealthChecks,
              });
            });
          }
        });
      }

      const enhancedUrls: Record<string, any> = {};
      const urlsData = secrets[jobId];

      for (const [exposeId, urlData] of Object.entries(urlsData)) {
        const opMapping = exposeIdToOpMap.get(exposeId);
        if (!opMapping) continue;

        const { opId, hasHealthChecks } = opMapping;
        let endpointStatus = 'OFFLINE';

        const opStatus = task?.getOperationStatus(opId)?.[opId];
        const isOpRunning = opStatus === 'running';

        if (isOpRunning) {
          if (hasHealthChecks) {
            if (
              nodeState?.shared?.job === jobId &&
              nodeState?.shared?.serviceUrlReady
            ) {
              endpointStatus = 'ONLINE';
            } else {
              endpointStatus = 'OFFLINE';
            }
          } else {
            endpointStatus = 'UNKNOWN';
          }
        }

        enhancedUrls[exposeId] = {
          opId,
          ...(typeof urlData === 'object' && urlData !== null ? urlData : {}),
          status: endpointStatus,
        };
      }

      response.endpoints = {
        urls: enhancedUrls,
      };
    }

    const completedOps = flowData.state.opStates.filter(
      (opState: any) => opState.endTime,
    );

    if (completedOps.length > 0) {
      response.results = {
        opStates: completedOps.map((opState: any) => ({
          operationId: opState.operationId,
          status: opState.status,
          exitCode: opState.exitCode,
          results: opState.results,
          logs: opState.logs?.slice(-10),
        })),
      };
    }

    return response;
  };

  sendJobInfoIfChanged();

  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (task) {
    const cleanupFunctions: Array<() => void> = [];
    const emitterRegistry: Map<string, { emitter: any; updateListener: () => void }> = new Map();

    const subscribeToEmitter = (opId: string, emitter: any) => {
      const existing = emitterRegistry.get(opId);
      if (existing && existing.emitter === emitter) return;

      if (existing && existing.emitter !== emitter) {
        existing.emitter.off('start', existing.updateListener);
        existing.emitter.off('exit', existing.updateListener);
        existing.emitter.off('error', existing.updateListener);
        existing.emitter.off('updateOpState', existing.updateListener);
      }

      emitter.setMaxListeners(50);

      const updateListener = () => sendJobInfoIfChanged();

      emitter.on('start', updateListener);
      emitter.on('exit', updateListener);
      emitter.on('error', updateListener);
      emitter.on('updateOpState', updateListener);

      emitterRegistry.set(opId, { emitter, updateListener });
    };

    for (const [opId, emitter] of (task as any).operationsEventEmitters.entries()) {
      subscribeToEmitter(opId, emitter);
    }

    const emitterPollInterval = setInterval(() => {
      for (const [opId, emitter] of (task as any).operationsEventEmitters.entries()) {
        subscribeToEmitter(opId, emitter);
      }
      sendJobInfoIfChanged();
    }, 2000);

    cleanupFunctions.push(() => clearInterval(emitterPollInterval));

    const keepaliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    cleanupFunctions.push(() => clearInterval(keepaliveInterval));

    const cleanup = () => {
      for (const { emitter, updateListener } of emitterRegistry.values()) {
        emitter.off('start', updateListener);
        emitter.off('exit', updateListener);
        emitter.off('error', updateListener);
        emitter.off('updateOpState', updateListener);
      }
      cleanupFunctions.forEach((fn) => fn());
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);
  } else {
    const keepaliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepaliveInterval);
      res.end();
    });

    req.on('error', () => {
      clearInterval(keepaliveInterval);
      res.end();
    });
  }
}

