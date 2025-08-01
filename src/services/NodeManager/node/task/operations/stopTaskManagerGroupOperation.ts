import TaskManager from '../TaskManager.js';

/**
 * Stops all operations currently running in the given group.
 * 
 * This method:
 * - Validates the group exists and is actively running
 * - Iterates over all ops in the group and stops them in parallel
 * - Waits for all stops to complete (or be caught if they fail)
 */
export async function stopTaskManagerGroupOperations(
    this: TaskManager,
    group: string
): Promise<void> {
    /** 
     * Look up the group context to get its operation IDs.
     * If the group doesn't exist in the execution plan, it's invalid.
     */
    const groupContext = this.executionPlan.find(ctx => ctx.group === group);
    if (!groupContext) {
        throw new Error("GROUP_NOT_FOUND");
    }

    /** 
     * Ensure we're currently within the provided group context before proceeding.
     * Prevents stopping inactive or completed groups.
     */
    if (this.currentGroup !== group) {
        throw new Error("GROUP_NOT_ACTIVE");
    }

    /** 
     * Attempt to stop each operation in parallel.
     * If any individual stop fails, we catch it and continue the rest.
     */
    const stopPromises = groupContext.ops.map((id) =>
        this.stopTaskManagerOperation(group, id).catch((err) => {
            console.warn(`Failed to stop operation ${id}:`, err.message);
        })
    );

    // Await all stop promises before resolving
    await Promise.all(stopPromises);
}
