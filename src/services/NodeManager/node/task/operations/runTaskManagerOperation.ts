import { EventEmitter } from 'events';
import { Operation, OperationType } from '@nosana/sdk';
import { extractLogsAndResultsFromLogBuffer } from '../../../../../providers/utils/extractLogsAndResultsFromLogBuffer.js';
import {
  Statuses,
  StopReason,
  DependencyContext,
  OperationProgressStatuses,
} from '../TaskManager.js';
import TaskManager from '../TaskManager.js';
import { Flow, type FlowSecrets, type JobExposeSecrets, type EndpointSecret } from '@nosana/sdk';

import { finalizeEnvOnOperation } from '../globalStore/finalizeEnv.js';
import {
  createResultsObject,
  extractResultFromLog,
} from '../../../../../providers/utils/extractResultsFromLogs.js';
import { stanatizeArrays } from '../globalStore/stanatizeArrays.js';
import { logEmitter } from '../../../monitoring/proxy/loggingProxy.js';
import { HealthcheckPayload } from '../../../../../types/healthCheckPayload.js';

/**
 * Executes a full lifecycle of a container-based operation using internal class state.
 *
 * This function is intended to be bound to a `TaskManager` instance using `.bind(this)`.
 * It handles:
 * - Setup
 * - Log streaming
 * - Abort controller registration
 * - Container execution
 * - Exit/error handling
 * - Cleanup
 *
 * It uses internal state like `this.repository`, `this.provider`, `this.job`, etc.,
 * and serves as the core execution driver for all operations.
 *
 * Keeps lifecycle doc comments in sync with original `setUpOperationFunc`.
 */
export async function runTaskManagerOperation(
  this: TaskManager,
  flow: Flow,
  op: Operation<OperationType>,
  dependent: string[],
): Promise<void> {
  /**
   * Retrieves the index of the operation within the job definition's ops array.
   *
   * This index is used to look up and update the operation's state in the repository.
   * It's necessary because the repository stores op states in an array, not a map,
   * so index-based access is required for performance and mutation.
   *
   * The `getOpStateIndex` method is passed from the TaskManager to maintain context
   * and ensure consistent lookup logic throughout the system.
   */
  const index = this.getOpStateIndex(op.id);

  /**
   * Creates a new EventEmitter instance that serves as the communication channel
   * for the lifecycle of this operation.
   * This emitter is used to handle logs, update operation state, and respond to various
   * execution events like 'start', 'exit', 'error', and 'end'.
   */
  const emitter = new EventEmitter();

  // register the emitter
  this.registerAndRelayOpEmitter(op.id, emitter);

  /**
   * Initializes and registers an AbortController specific to this operation ID.
   * This controller is used to handle cancellation of the operation.
   * It is tied to the main task manager's AbortController, so a global stop
   * will also trigger this one unless already aborted.
   */
  const abort = new AbortController();

  const handleMainAbort = () => {
    emitter.emit('log', 'Operation Stopping', 'info');

    this.operationStatus.set(op.id, OperationProgressStatuses.STOPPING);
    abort.abort(this.mainAbortController.signal.reason);
  };

  this.mainAbortController.signal.addEventListener('abort', handleMainAbort);
  this.abortControllerMap.set(op.id, abort);

  /**
   * quit the operation if the main controller is already emmited
   */
  if (this.mainAbortController.signal.aborted) {
    this.repository.updateOpState(this.job, index, {
      exitCode: 0,
      startTime: Date.now(),
      endTime: Date.now(),
      status: this.getStatus(this.mainAbortController.signal.reason, 'ops'),
    });

    return Promise.resolve();
  }

  /**
   * Subscribes to 'log' events emitted during operation execution.
   *
   * These events are typically triggered by the operation’s execution engine (e.g., a container)
   * to emit stdout/stderr logs. Every time a log is received, it's appended to the operation’s
   * existing logs in the repository using `updateOpStateLogs`.
   *
   * This enables real-time or post-mortem log inspection, useful for debugging or UI display.
   * Logs are stored in a buffer-like array, and later parsed during the `exit` or `error` phase
   * to extract structured logs and results.
   */
  emitter.on('log', (log, logType, type) => {
    // add logs to the log manager
    this.addlog({
      opId: op.id,
      group: this.currentGroup ?? '',
      type: type,
      message: log,
      timestamp: Date.now(),
    });

    if (type == 'container') {
      // FOR NOW Skip if it's an actual Error object
      // TODO: Format errors and insert
      if (log instanceof Error) return;
      this.repository.updateOpStateLogs(this.job, index, {
        log,
        type: logType || 'stdout',
      });
      this.repository.displayLog(log);
    }
  });

  /**
   * Subscribes to 'updateOpState' events that allow partial mutation of the operation's state.
   *
   * This is a flexible and general-purpose hook. It accepts a `body` payload which is a partial
   * `OpState` object, which is merged into the existing operation state in the repository.
   *
   * Example use cases:
   * - Updating metadata like progress percentage, internal flags, or status messages
   * - Recording dynamic outputs or intermediate results during execution
   *
   * This gives the running operation a channel to self-report its own evolving state.
   */
  emitter.on('updateOpState', (body) => {
    this.repository.updateOpState(this.job, index, body);
  });

  /**
   * update the host name
   */
  emitter.on('updateOpHost', (body) => {
    this.setHost(op.id, body.name);
  });

  /**
   * Subscribes to the 'start' event, which marks the official beginning of an operation’s execution.
   *
   * When triggered, it updates the corresponding operation’s status to 'running' and records
   * the `startTime` timestamp. This serves as the entry point for lifecycle tracking of this op.
   *
   * Important: This should be emitted **after** all setup is complete and just before the core
   * execution logic begins (e.g., launching a container or invoking a function).
   *
   * This is crucial for analytics, timeout enforcement, and auditing purposes.
   */
  emitter.on('start', () => {
    const opName = (op as any).name || op.id;
    this.addlog({
      opId: op.id,
      group: this.currentGroup ?? '',
      type: 'info',
      message: `Operation Started: ${opName}`,
      timestamp: Date.now(),
    });

    this.operationStatus.set(op.id, OperationProgressStatuses.RUNNING);

    this.repository.updateOpState(this.job, index, {
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
    });
  });

  /**
   * Subscribes to the 'exit' event, which signals that the operation has finished executing.
   *
   * This event may fire under normal completion, error, or external cancellation (abort).
   *
   * What this handler does:
   * - Determines whether the operation was aborted or completed naturally.
   * - Uses the exit code and abort reason to infer the final operation status.
   * - Converts raw log strings to a buffer, then extracts structured logs and results.
   * - Updates the operation's state in the repository with logs, results, exit code, status, and end time.
   */
  emitter.on('exit', ({ exitCode }: { exitCode: number }) => {
    const opName = (op as any).name || op.id;
    this.addlog({
      opId: op.id,
      group: this.currentGroup ?? '',
      type: 'info',
      message: `Operation Completed: ${opName}`,
      timestamp: Date.now(),
    });

    this.operationStatus.set(op.id, OperationProgressStatuses.FINISHED);

    const wasAborted = abort.signal.aborted;
    const reason = wasAborted ? abort.signal.reason : undefined;

    const status = wasAborted
      ? this.getStatus(reason as StopReason, 'ops')
      : exitCode === 0
      ? Statuses.SUCCESS
      : Statuses.FAILED;

    const opState = this.repository.getOpState(this.job, index);

    const results: {} | undefined = op.results
      ? createResultsObject(op.results)
      : undefined;

    if (results && op.results) {
      for (const logObj of opState.logs) {
        extractResultFromLog(results, logObj, op.results);
      }
    }

    this.repository.updateOpState(this.job, index, {
      logs: opState.logs,
      results,
      exitCode,
      endTime: Date.now(),
      status,
    });

    this.setResults(op.id, results ?? {});
  });

  /**
   * Subscribes to the 'error' event, which is emitted when an unhandled exception or failure
   * occurs during the operation's execution lifecycle.
   *
   * This could result from:
   * - Internal execution issues (e.g., runtime crash, invalid state)
   * - External interruptions (e.g., aborts triggered manually or by timeout)
   *
   * What this handler does:
   * - Determines whether the operation was aborted or failed on its own.
   * - Sets the final operation status accordingly.
   * - Parses accumulated logs to extract clean output and structured results.
   * - Updates the operation state with final logs, results, status, exit code, and end time.
   *
   * Notes:
   * - `exitCode: 2` is used as a standard error indicator (non-zero, but distinct from process exit).
   * - The actual `err` is not persisted currently, but could be added to logs in future.
   */
  emitter.on('error', (err: any) => {
    const wasAborted = abort.signal.aborted;
    const reason = wasAborted ? abort.signal.reason : undefined;

    this.operationStatus.set(
      op.id,
      wasAborted
        ? OperationProgressStatuses.STOPPED
        : OperationProgressStatuses.FAILED,
    );

    const status = wasAborted
      ? this.getStatus(reason as StopReason, 'ops')
      : Statuses.FAILED;

    if (!wasAborted) {
      emitter.emit('log', 'Operation Failed', 'info');
      emitter.emit('log', err, 'error');
    } else {
      emitter.emit('log', 'Operation Completed', 'info');
    }

    const opState = this.repository.getOpState(this.job, index);

    const results: {} | undefined = op.results
      ? createResultsObject(op.results)
      : undefined;

    if (results && op.results) {
      for (const logObj of opState.logs) {
        extractResultFromLog(results, logObj, op.results);
      }
    }

    this.repository.updateOpState(this.job, index, {
      results,
      logs: opState.logs,
      exitCode: 2,
      status,
      endTime: Date.now(),
    });

    this.setResults(op.id, results ?? {});
  });

  /**
   * what else can we clean up here?
   */
  emitter.on('end', async () => {
    emitter.removeAllListeners();
    this.abortControllerMap.delete(op.id);
    this.mainAbortController.signal.removeEventListener(
      'abort',
      handleMainAbort,
    );
  });

  /**
   * Subscribes to the 'healthcheck:startup:success' event, which is emitted when
   * the container for a given operation has started up successfully and passed its
   * initial health checks.
   *
   * Once this event fires, we treat the current operation as "ready", and begin triggering
   * the **next operations** that are waiting for this one to start.
   *
   * What happens here:
   * - For each of this operation's dependents (i.e., ops that declared `depends_on: [thisOp]`)
   * - We re-check their dependents using `getDependentsFromPlan`, ensuring the correct downstream chain.
   * - We then queue them for execution using `trackGroupOperationPromise` and `setUpOperationFunc`.
   *
   * This mechanism allows dynamic chaining of operations based on runtime readiness,
   * ensuring ops start only after their declared dependencies are healthy and active.
   */
  emitter.on('healthcheck:startup:success', (payload: HealthcheckPayload) => {
    emitter.emit('log', 'Operation StartUp Success', 'info');

    const port = payload?.port;
    if (typeof port === 'number' || typeof port === 'string') {
      const portKey = String(port);
      const stored_url = this.getByPath(op.id, `endpoint.${portKey}`) as
        | string
        | undefined;
      if (!stored_url) return;

      const url = stored_url.startsWith('http')
        ? stored_url
        : `https://${stored_url}`;

      logEmitter.emit('log', {
        class: 'FlowHandler',
        method: 'operationExposed',
        arguments: [
          {
            port,
            opId: op.id,
          },
          true,
        ],
        timestamp: new Date().toISOString(),
        type: 'return',
        result: url,
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

      const targetHost = url.replace(/^https?:\/\//, '');
      let updated = false;
      const newJobSecrets: JobExposeSecrets = { ...jobSecrets };
      for (const [exposeId, value] of Object.entries(jobSecrets)) {
        const v = value as EndpointSecret;
        if (v && typeof v === 'object' && v.url) {
          const host = v.url.replace(/^https?:\/\//, '');
          if (host === targetHost) {
            newJobSecrets[exposeId] = { ...v, status: 'ONLINE' };
            updated = true;
          }
        }
      }

      if (updated) {
        this.repository.updateflowStateSecret(this.job, {
          [this.job]: newJobSecrets,
        });
        emitter.emit('flow:secrets-updated', {
          flowId: this.job,
          opId: op.id,
        });
      }
    } catch {}
    }

    // Loop through each operation that depends on this one
    for (const id of dependent) {
      const dependencyContext = this.dependecyMap.get(id) as DependencyContext;

      // Schedule the dependent operation to start, now that its dependency is healthy
      this.currentGroupOperationsPromises.set(
        id,
        this.trackGroupOperationPromise(
          id,
          this.setUpOperationFunc(flow, id, dependencyContext.dependents),
        ),
      );
    }
  });

  emitter.on('healthcheck:continuous:failure', (payload: HealthcheckPayload) => {
    const port = payload?.port;
    if (typeof port !== 'number' && typeof port !== 'string') return;

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
        if (
          v &&
          typeof v === 'object' &&
          v.opID === op.id &&
          String(v.port) === String(port)
        ) {
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
        emitter.emit('flow:secrets-updated', {
          flowId: this.job,
          opId: op.id,
        });
      }
    } catch {}
  });

  emitter.on('healthcheck:url:exposed', () => {
    emitter.emit('log', 'Operation Service URL exposed', 'info');
  });

  /**
   * Hydrate an operation by resolving all literal references in its `args`.
   *
   * Interpolates strings like:
   *   - %%ops.<opId>.results.someKey%%
   *   - %%ops.<opId>.host%%
   * against the TaskManager's global store, returning a new `Operation<T>` with
   * the same `type`, `id`, and `results`, but with `args` fully substituted.
   *
   * Notes:
   * - Only `args` are modified. `type`, `id`, and `results` are preserved.
   * - `args.env` values are normalized to strings after interpolation.
   * - Unresolved literals currently resolve to empty strings. If you prefer
   *   strict behavior, update `resolveLiteralsInString` to throw on misses.
   *
   * @example
   * // Before:
   * // op.args.env.API = "http://%%ops.nginx-1.host%%:80"
   * const interpolatedOp = this.interpolateOperation(op);
   * // After:
   * // interpolatedOp.args.env.API = "http://nginx-1:80"
   */

  let interpolatedOp = op;

  try {
    interpolatedOp = this.interpolateOperation(op);

    /**
     * now after interpolation we want to proceed to
     * TransformCollections(interpolatedOp)
     */
    interpolatedOp = this.transformCollections(interpolatedOp);
    interpolatedOp = finalizeEnvOnOperation(interpolatedOp);
    interpolatedOp = stanatizeArrays(interpolatedOp);
  } catch (error: any) {
    this.repository.updateOpStateLogs(this.job, index, {
      type: 'nodeerr',
      log: error.message,
    });

    this.repository.updateOpState(this.job, index, {
      exitCode: 0,
      startTime: Date.now(),
      endTime: Date.now(),
      status: Statuses.FAILED,
    });

    emitter.emit('log', 'Operation Stopping', 'info');

    this.operationStatus.set(op.id, OperationProgressStatuses.STOPPING);
    abort.abort(this.mainAbortController.signal.reason);

    return Promise.resolve();
  }

  /**
   * Executes the full lifecycle of a container-based operation:
   *
   * 1. **Start Phase**: Runs the container using the operation’s configuration,
   *    emits all lifecycle events (`start`, `log`, `updateOpState`, `exit`, `error`, `end`),
   *    and streams logs via the provided `EventEmitter`.
   *
   * 2. **Stop Phase**: Cleans up after the operation completes by stopping and removing
   *    the container, its associated network, and optionally its Docker image
   *    (if marked as authenticated/private).
   *
   * The underlying method blocks until the operation is fully completed or aborted,
   * and ensures that no containers or networks are left dangling.
   *
   * This method is essential for:
   * - Enforcing deterministic cleanup
   * - Supporting clean restarts and re-runs
   * - Ensuring resource isolation per operation
   *
   * @returns Promise<void> that resolves only after the operation has run and cleanup has completed
   */
  return this.provider.runTaskManagerOperation(
    flow,
    interpolatedOp,
    abort,
    emitter,
  );
}
