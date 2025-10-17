import TaskManager, { OperationProgressStatuses } from '../TaskManager.js';

/**
 * Restarts a single operation (`opId`) within the currently running group (`group`).
 *
 * This function is meant to be rebound to a `TaskManager` instance using `.bind(this)`, so it can
 * interact with all internal state and methods just like a native class method.
 *
 * The restart process:
 * - Aborts the operation's current execution
 * - Waits for its cleanup to complete
 * - Holds the group's completion to avoid premature advancement
 * - Re-executes the same operation within the current group
 */
export async function restartTaskManagerOperation(
  this: TaskManager,
  group: string,
  opId: string,
): Promise<void> {
  /**
   * Check if the provided group actually exists in the execution plan.
   * If not, it likely means the group name is invalid or not registered.
   */
  const groupExists = this.executionPlan.some((ctx) => ctx.group === group);
  if (!groupExists) throw new Error(`GROUP_NOT_FOUND`);

  /**
   * Only allow restart if the group is the one currently being executed.
   * This prevents restarting ops from already-finished groups or future ones.
   */
  if (this.currentGroup !== group) {
    throw new Error('GROUP_NOT_ACTIVE');
  }

  /**
   * If the operation is already in the process of being restarted or stopped,
   * we don't want to allow another concurrent mutation.
   */
  if (this.lockedOperations.has(opId)) {
    throw new Error(`OPERATION_${this.lockedOperations.get(opId)}`);
  }

  // Mark this op as "RESTARTING" so no one else touches it mid-process
  this.lockedOperations.set(opId, 'RESTARTING');
  this.operationStatus.set(opId, OperationProgressStatuses.RESTARTING);
  // reflect restarting in OpState
  try {
    const idx = this.getOpStateIndex(opId);
    this.repository.updateOpState(this.job, idx, { status: 'restarting' });
  } catch {}

  const emitter = this.operationsEventEmitters.get(opId);
  if (emitter) {
    emitter.emit('log', 'Restarting Operation', 'info');
  }

  /**
   * Get the controller used to abort this operation's execution.
   * This should have been set up when the op was first started.
   */
  const controller = this.abortControllerMap.get(opId);

  /**
   * The following block creates a "placeholder promise" that we temporarily insert into the group’s
   * operation map. This ensures that even if all the original ops complete while we're restarting,
   * the group will not advance to the next one until we explicitly release this block.
   *
   * This is CRITICAL to prevent race conditions where the restart is too late, and the system
   * thinks the group has completed.
   */
  const groupHold = (() => {
    let release!: () => void;
    const placeholder = new Promise<void>((res) => (release = res));

    const abortHandler = () => {
      release();
      this.mainAbortController.signal.removeEventListener(
        'abort',
        abortHandler,
      );
    };

    this.mainAbortController.signal.addEventListener('abort', abortHandler);

    return {
      groupHoldPromisePlaceHolder: placeholder,
      releaseGroupOperationBlock: () => {
        release();
        this.mainAbortController.signal.removeEventListener(
          'abort',
          abortHandler,
        );
      },
    };
  })();

  // Use a special ID to register this placeholder in the group tracking map
  // The op will still retain its original ID for restart purposes
  const placeholderId = `${opId}::restart-block`;
  this.trackGroupOperationPromise(
    placeholderId,
    groupHold.groupHoldPromisePlaceHolder,
  );

  // Abort the currently running operation
  // This should trigger container teardown, logs finalization, and state updates
  controller?.abort('restart');

  /**
   * If the operation had already started, wait for it to finish fully (even if it failed).
   * This avoids stomping over any still-pending teardown work.
   */
  const originalPromise = this.currentGroupOperationsPromises.get(opId);
  if (originalPromise) {
    try {
      await originalPromise;
    } catch {
      // We intentionally ignore any error here.
      // Our goal is just to make sure the cleanup is finished, not whether it succeeded.
    }
  }

  /**
   * Now that the original op has been stopped, we need to restart it.
   * Get the latest flow data from storage — this could’ve been updated elsewhere in the meantime.
   */
  const flow = this.repository.getFlow(this.job);

  /**
   * Look up the original operation details.
   * This should always exist unless something went very wrong.
   */
  const op = this.opMap.get(opId);
  if (!op) throw new Error(`INVALID_OPID`);

  /**
   * Re-register the operation for execution and begin tracking it again.
   * This effectively restarts the operation from scratch.
   */
  this.currentGroupOperationsPromises.set(
    opId,
    this.trackGroupOperationPromise(
      opId,
      this.setUpOperationFunc(flow, opId, []),
    ),
  );

  /**
   * Now that we've re-launched the op and it's being tracked,
   * we can safely release the group hold so the group can eventually complete.
   */
  groupHold.releaseGroupOperationBlock();

  // Finally, unlock the operation so other calls (like restart or stop) can act on it again
  this.lockedOperations.delete(opId);
}
