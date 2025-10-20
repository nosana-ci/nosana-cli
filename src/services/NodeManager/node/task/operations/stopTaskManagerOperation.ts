import TaskManager, {
  OperationProgressStatuses,
  StopReasons,
} from '../TaskManager.js';
import { type FlowSecrets, type JobExposeSecrets, type EndpointSecret } from '@nosana/sdk';

/**
 * Publicly exposed method to stop a running operation within the active group.
 *
 * This:
 * - Validates the operation belongs to the current group
 * - Prevents concurrent mutation using `lockedOperations`
 * - Aborts the operation's container execution
 * - Waits for full cleanup (exit/error + container teardown)
 * - Ensures promise is resolved before continuing
 *
 * Usage: await taskManager.stopTaskOperation(groupId, opId)
 */
export async function stopTaskManagerOperation(
  this: TaskManager,
  group: string,
  opId: string,
): Promise<void> {
  /**
   * Check if the provided group exists in the execution plan.
   * If not, the group name is invalid or unregistered.
   */
  const groupExists = this.executionPlan.some((ctx) => ctx.group === group);
  if (!groupExists) {
    throw new Error(`GROUP_NOT_FOUND`);
  }

  /**
   * If the provided group is not currently active, we still allow a stop attempt
   */
  const inProvidedGroup = this.executionPlan
    .find((ctx) => ctx.group === group)
    ?.ops.includes(opId);
  if (!inProvidedGroup) {
    throw new Error('GROUP_NOT_FOUND');
  }

  /**
   * Prevent concurrent stop or restart operations on the same op.
   * This lock guards against race conditions or double-aborts.
   */
  if (this.lockedOperations.has(opId)) {
    throw new Error(`OPERATION_${this.lockedOperations.get(opId)}`);
  }

  const currentStatus = this.operationStatus.get(opId);

  if (currentStatus == OperationProgressStatuses.STOPPED) {
    return;
  }

  this.lockedOperations.set(opId, 'STOPPING');
  this.operationStatus.set(opId, OperationProgressStatuses.STOPPING);

  const emitter = this.operationsEventEmitters.get(opId);
  if (emitter) {
    emitter.emit('log', 'Stopping Operation', 'info');
  }

  // notify listeners that flow state changed to reflect STOPPING
  this.events.emit('flow:updated', {
    jobId: this.job,
    opId,
    type: 'status:stopping',
  });

  /**
   * Retrieve the AbortController for this op.
   * If it's missing, something went wrong during registration or setup.
   */
  const controller = this.abortControllerMap.get(opId);

  /**
   * Abort the operation — this will trigger cleanup via its lifecycle handlers.
   * The container will be stopped and teardown will run automatically.
   */
  controller?.abort(StopReasons.STOPPED);

  /**
   * Wait for the original promise tied to this operation to resolve.
   * Even if it fails (e.g., due to abort), we silently swallow the error
   * since the focus here is cleanup, not success.
   */
  const originalPromise = this.currentGroupOperationsPromises.get(opId);
  if (originalPromise) {
    try {
      await originalPromise;
    } catch {
      // swallow error, we're only waiting for cleanup
    }
  }

  /**
   * Ensure we clean up the operation's reference in the promise map
   * to avoid holding stale references or leaking memory.
   */
  this.currentGroupOperationsPromises.delete(opId);

  // Unlock the operation so it can be restarted or reused later
  this.lockedOperations.delete(opId);

  // Ensure final STOPPED state is reflected in memory and repository
  this.operationStatus.set(opId, OperationProgressStatuses.STOPPED);
  const index = this.getOpStateIndex(opId);
  const opState = this.repository.getOpState(this.job, index);
  const alreadyEnded = !!opState.endTime;
  if (!alreadyEnded) {
    this.repository.updateOpState(this.job, index, {
      status: this.getStatus(StopReasons.STOPPED, 'ops'),
      endTime: Date.now(),
    });
  }
  this.events.emit('flow:updated', {
    jobId: this.job,
    opId,
    type: 'status:stopped',
  });

  try {
    const flow = this.repository.getFlow(this.job);
    const secrets = flow?.state?.secrets as FlowSecrets | undefined;
    let jobSecrets: JobExposeSecrets = {};
    if (
      secrets &&
      typeof secrets[this.job] === 'object' &&
      secrets[this.job] !== 'private' &&
      secrets[this.job] !== 'public' &&
      secrets[this.job]
    ) {
      jobSecrets = secrets[this.job] as JobExposeSecrets;
    }

    let updated = false;
    const newJobSecrets: JobExposeSecrets = {};

    for (const [exposeId, value] of Object.entries(jobSecrets)) {
      const v = value as EndpointSecret;
      if (v && typeof v === 'object' && v.opID === opId) {
        newJobSecrets[exposeId] = { ...v, status: 'OFFLINE' };
        updated = true;
      } else {
        newJobSecrets[exposeId] = v;
      }
    }

    if (updated) {
      this.repository.updateflowStateSecret(this.job, {
        [this.job]: newJobSecrets,
      });
      this.events.emit('flow:updated', {
        jobId: this.job,
        opId,
        type: 'flow:secrets-updated',
      });
    }
  } catch {}
}
