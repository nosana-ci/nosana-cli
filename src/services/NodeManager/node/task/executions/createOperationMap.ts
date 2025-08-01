import TaskManager, { OperationProgressStatuses, TaskManagerOps } from '../TaskManager.js';
import { Operation, OperationType } from "@nosana/sdk";

/**
 * Creates a map from operation ID to operation object.
 * 
 * This is used for fast lookup of operations by ID during validation,
 * dependency resolution, and execution planning.
 * 
 * It also ensures that there are no duplicate operation IDs in the job definition.
 */
export function createOperationMap(this: TaskManager): Map<string, Operation<OperationType>> {
    /** 
     * Initialize a map to store operations and a list to track duplicates.
     */
    const map = new Map<string, Operation<OperationType>>();
    const duplicates: string[] = [];

    /** 
     * Iterate over all operations and populate the map.
     * If an ID is already seen, collect it as a duplicate.
     */
    for (const op of this.operations as TaskManagerOps) {
        if (map.has(op.id)) {
            duplicates.push(op.id);
        } else {
            map.set(op.id, op);
        }
    }

    /** 
     * If any duplicate IDs were found, throw an error immediately.
     */
    if (duplicates.length > 0) {
        throw new Error(`Duplicate operation IDs found: ${duplicates.join(", ")}`);
    }

    return map;
}
