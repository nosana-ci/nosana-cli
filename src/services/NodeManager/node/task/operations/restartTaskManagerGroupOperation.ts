import TaskManager from '../TaskManager.js';

/**
 * Restarts all operations in the given group sequentially.
 *
 * This method:
 * - Validates the group exists and is active
 * - Iterates through ops one-by-one, restarting each in order
 * - If any restart fails, it logs and continues to the next op
 */
export async function restartTaskManagerGroupOperations(
  this: TaskManager,
  group: string,
): Promise<void> {
  /**
   * Look up the group and its operation list.
   * If the group doesn't exist in the plan, it's invalid.
   */
  const groupContext = this.executionPlan.find((ctx) => ctx.group === group);
  if (!groupContext) {
    throw new Error('GROUP_NOT_FOUND');
  }

  /**
   * Ensure the provided group is currently active.
   * Restarting ops from inactive or future groups is not allowed.
   */
  if (this.currentGroup !== group) {
    throw new Error('GROUP_NOT_ACTIVE');
  }

  /**
   * Restart each operation one at a time.
   * If any restart fails, log and continue.
   */
  for (const id of groupContext.ops) {
    try {
      await this.restartTaskManagerOperation(group, id);
    } catch (err) {
      console.warn(`Failed to restart operation ${id}:`, err);
    }
  }
}
