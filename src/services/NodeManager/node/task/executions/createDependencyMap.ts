import TaskManager, { TaskManagerOps } from "../TaskManager.js";

/**
 * Creates a dependency map for all operations.
 *
 * Returns a Map of operation ID -> {
 *   dependencies: operation IDs this op waits for
 *   dependents: operation IDs that wait for this op
 * }
 *
 * This allows the task manager to:
 * - Dynamically trigger downstream ops when upstream completes
 * - Track dependencies and dependents efficiently during execution
 * - Use alongside the execution plan to resolve execution flow
 */
export function createDependencyMap(this: TaskManager): Map<string, { dependencies: string[]; dependents: string[] }> {
  const map = new Map<string, { dependencies: string[]; dependents: string[] }>();

  // Initialize map with declared dependencies
  for (const op of this.operations as TaskManagerOps ) {
    map.set(op.id, {
      dependencies: op.execution?.depends_on ?? [],
      dependents: [],
    });
  }

  // Populate dependents for each dependency
  for (const [id, { dependencies }] of map.entries()) {
    for (const depId of dependencies) {
      if (!map.has(depId)) continue;
      map.get(depId)!.dependents.push(id);
    }
  }

  return map;
}
