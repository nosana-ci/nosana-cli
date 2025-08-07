import TaskManager, { TaskManagerOps } from '../TaskManager.js';
import { ExecutionContext } from '../TaskManager.js';

/**
 * Converts the list of operations into a structured execution plan.
 *
 * This function focuses only on grouping operations by execution group.
 * Dependency resolution (dependencies + dependents) is now handled separately
 * in `createDependencyMap()`.
 *
 * Each `ExecutionContext` includes:
 * - `group`: The logical group name
 * - `ops`: Array of operations with their `id` only
 */
export function createExecutionPlan(this: TaskManager): ExecutionContext[] {
  /**
   * Map of groupName -> [op.id, ...]
   * Collects which operations belong to which execution group.
   */
  const groups = new Map<string, string[]>();

  // Build group structure
  for (const op of this.operations as TaskManagerOps) {
    const group = op.execution?.group ?? op.id;

    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(op.id);
  }

  /**
   * Construct final execution plan grouped by execution group.
   * Each op only contains its ID; dependency mapping is separate.
   */
  const result: ExecutionContext[] = [];

  for (const [group, opIds] of groups.entries()) {
    const ops = opIds.map((id) => ({ id }));
    result.push({ group, ops: opIds });
  }

  return result;
}
