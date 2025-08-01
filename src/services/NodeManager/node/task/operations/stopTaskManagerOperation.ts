import TaskManager, { OperationProgressStatuses, StopReasons } from '../TaskManager.js';

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
    opId: string
): Promise<void> {
    /** 
     * Check if the provided group exists in the execution plan.
     * If not, the group name is invalid or unregistered.
     */
    const groupExists = this.executionPlan.some(ctx => ctx.group === group);
    if (!groupExists) {
        throw new Error(`GROUP_NOT_FOUND`);
    }

    /** 
     * Ensure the provided group is the one currently running.
     * Operations in inactive or completed groups cannot be stopped.
     */
    if (this.currentGroup !== group) {
        throw new Error("GROUP_NOT_ACTIVE");
    }

    /** 
     * Prevent concurrent stop or restart operations on the same op.
     * This lock guards against race conditions or double-aborts.
     */
    if (this.lockedOperations.has(opId)) {
        throw new Error(`OPERATION_${this.lockedOperations.get(opId)}`);
    }

    this.lockedOperations.set(opId, "STOPPING");
    this.operationStatus.set(opId, OperationProgressStatuses.STOPPING)

    const emitter = this.operationsEventEmitters.get(opId)
    if(emitter){
        emitter.emit("log", "Stopping Operation", "info")
    }

    /** 
     * Retrieve the AbortController for this op.
     * If it's missing, something went wrong during registration or setup.
     */
    const controller = this.abortControllerMap.get(opId);
    if (!controller) {
        this.lockedOperations.delete(opId);
        throw new Error(`INVALID_OPS: No abort controller found for ${opId}`);
    }

    /** 
     * Abort the operation — this will trigger cleanup via its lifecycle handlers.
     * The container will be stopped and teardown will run automatically.
     */
    controller.abort(StopReasons.STOPPED);

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
}
