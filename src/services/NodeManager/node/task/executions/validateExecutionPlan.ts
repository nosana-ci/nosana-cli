import TaskManager, { TaskManagerOps } from '../TaskManager.js';

/**
 * Validates the structure and dependencies in the execution plan.
 *
 * Checks for:
 * - Self-dependencies
 * - Dependencies on undefined operations
 * - Cross-group dependencies (which are currently disallowed)
 *
 * If any validation errors are found, the function throws with a detailed message.
 */
export function validateExecutionPlan(this: TaskManager): void {
  const errors: string[] = [];

  for (const op of this.operations as TaskManagerOps) {
    const opId = op.id;
    const dependsOn = op.execution?.depends_on ?? [];

    /**
     * Check if the operation depends on itself.
     */
    if (dependsOn.includes(opId)) {
      errors.push(
        `Invalid dependency: Operation '${opId}' cannot depend on itself.`,
      );
    }

    for (const depId of dependsOn) {
      const depOp = this.opMap.get(depId);

      /**
       * If the dependency is not found in the op map, it's invalid.
       */
      if (!depOp) {
        errors.push(
          `Invalid dependency: Operation '${opId}' depends on non existent op '${depId}'.`,
        );
        continue;
      }

      /**
       * Check for cross-group dependency violations.
       */
      const opGroup = op.execution?.group;
      const depGroup = depOp.execution?.group;

      if (opGroup !== depGroup) {
        errors.push(
          `Invalid dependency: '${opId}' in group '${opGroup}' depends on '${depId}' in group '${depGroup}'`,
        );
      }
    }
  }

  /**
   * If any validation issues were discovered, throw an aggregated error.
   */
  if (errors.length > 0) {
    throw new Error(
      'Execution Plan Validation Failed:\n' +
        errors.map((e) => `- ${e}`).join('\n'),
    );
  }
}
