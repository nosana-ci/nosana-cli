import TaskManager from '../TaskManager.js';
import { StopReason } from '../TaskManager.js';

/**
 * Immediately stops the current task flow with the given reason.
 *
 * This triggers:
 * - Flow-wide abort via `mainAbortController`
 * - Lifecycle shutdown for any running ops
 * - A consistent status applied to the flow and all ops
 *
 * The stop reason determines what status each op and the overall flow will be marked with.
 *
 * | Reason   | Ops Status | Flow Status |
 * |----------|------------|-------------|
 * | expired  | success    | success     |
 * | stopped  | stopped    | stopped     |
 * | quit     | failed     | failed      |
 * | unknown  | failed     | failed      |
 *
 * `getStatus()` is used internally to apply the correct status values.
 */
export function stopAllTaskManagerOperations(
  this: TaskManager,
  reason: StopReason,
): void {
  /**
   * Resolve the correct flow-level status from the stop reason.
   * This ensures consistent results across all status tracking.
   */
  this.status = this.getStatus(reason, 'flow');

  /**
   * Abort the main controller signal, which in turn should cascade
   * down to any op-level AbortControllers that are still active.
   */
  this.mainAbortController.abort(reason);
}
