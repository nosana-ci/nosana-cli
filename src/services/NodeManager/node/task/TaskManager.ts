import type WebSocket from 'ws';
import EventEmitter from 'events';
import { JobDefinition, Operation, OperationType } from '@nosana/sdk';

import { NodeRepository } from '../../repository/NodeRepository.js';
import { Provider } from '../../provider/Provider.js';
import { runTaskManagerOperation } from './operations/runTaskManagerOperation.js';
import { restartTaskManagerOperation } from './operations/restartTaskManagerOperation.js';
import { stopTaskManagerOperation } from './operations/stopTaskManagerOperation.js';
import { stopTaskManagerGroupOperations } from './operations/stopTaskManagerGroupOperation.js';
import { restartTaskManagerGroupOperations } from './operations/restartTaskManagerGroupOperation.js';
import { createOperationMap } from './executions/createOperationMap.js';
import { createExecutionPlan } from './executions/createExecutionPlan.js';
import { validateExecutionPlan } from './executions/validateExecutionPlan.js';
import { stopAllTaskManagerOperations } from './operations/stopAllTaskManagerOperations.js';
import { createInitialFlow } from './helpers/createInitialFlow.js';
import { createDependencyMap } from './executions/createDependencyMap.js';
import {
  getCurrentGroup,
  getCurrentGroupStatus,
  getGroupStatus,
  getOperationsStatus,
  getOperationStatus,
} from './operations/getOperationsInfos.js';
import {
  addLog,
  getAllLogs,
  getLogsByGroup,
  getLogsByOp,
  subscribe,
  unsubscribe,
} from './loggers/logManager.js';
import { moveTaskManagerGroupOperations } from './operations/moveTaskManagerGroupOperation.js';
import {
  setResult,
  setResults,
  setHost,
  setDefaults,
  rehydrateEndpointsForOperation,
  getByPath,
  resolveLiteralsInString,
  interpolate,
  interpolateOperation,
  transformCollections,
} from './globalStore/index.js';
import { Flow } from '../../provider/types.js';
import { configs } from '../../configs/configs.js';
import { getSDK } from '../../../sdk.js';

export type TaskManagerOps = Array<Operation<OperationType>>;

export type ExecutionContext = {
  group: string;
  ops: string[];
};

export type DependencyContext = {
  dependencies: string[];
  dependents: string[];
};

export const StopReasons = {
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  STOPPED: 'stopped',
  QUIT: 'quit',
  UNKNOWN: 'unknown',
  RESTART: 'restart',
} as const;

export type StopReason = (typeof StopReasons)[keyof typeof StopReasons];

export const Statuses = {
  SUCCESS: 'success',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;

export const OperationProgressStatuses = {
  FINISHED: 'finished',
  STOPPED: 'stopped',
  FAILED: 'failed',
  RUNNING: 'running',
  RESTARTING: 'restarting',
  STOPPING: 'stopping',
  STARTING: 'starting',
  WAITING: 'waiting',
  PENDING: 'pending',
  INIT: 'init',
} as const;

export type LogType = 'container' | 'info' | 'error';

export interface TaskLog {
  opId: string;
  group: string;
  type: LogType;
  timestamp: number;
  message: any;
}

export type OperationData = {
  host?: string;
  endpoint?: {
    [key: string]: string;
  };
  deployment_endpoint?: string;
  results?: Record<string, any>;
};

type InterpolateFn = <T>(value: T) => T;
type InterpolateOpFn = <T extends OperationType>(
  op: Operation<T>,
) => Operation<T>;

export type GlobalDataStore = Record<string, OperationData>;

export type GlobalStore = {
  job: string;
  host: string;
  project: string;
  frps_address: string;
  variables?: Record<string, string>;
};

export type Status = (typeof Statuses)[keyof typeof Statuses];

export default class TaskManager {
  /**
   * All operations defined in the Job Definition (JD).
   */
  protected operations: TaskManagerOps | undefined;

  /**
   * The ordered execution plan built from the job definition.
   * Each item represents a group of ops that run together horizontally.
   */
  protected executionPlan: ExecutionContext[] = [];

  /**
   * this creates a map to assign the dependency
   */
  protected dependecyMap: Map<string, DependencyContext> = new Map();

  /**
   * A map for fast lookup of operations by their ID.
   * Useful during validation and execution.
   */
  protected opMap: Map<string, Operation<OperationType>> = new Map();

  // /**
  //  * A map for fast lookup of operations export urls.
  //  */
  // protected exportMap: Map<string, string> = new Map();

  /**
   * Global data store.
   *
   * This allows operations to reference data produced by others using literals like:
   *   "%%global.frps_address%%"
   *   "%%global.project%%"
   *
   * Supported keys:
   * - frps_address: The current FRPS address.
   * - project: The project public key of the jobs project.
   */
  protected globalStore: GlobalStore;
  /**
   * Global data store for all operations in a job definition.
   *
   * This allows operations to reference data produced by others using literals like:
   *   "%%ops.nginx-1.results.someKey%%"
   *   "%%ops.nginx-1.host%%"
   *
   * Supported keys:
   * - result: Stores the output of an operation so it can be accessed later, even if it was unknown at the start of the job.
   * - host: Stores the reachable host/URL of the operation. Since Docker container names are dynamic,
   *         this ensures other operations can communicate with it without needing to know the name in advance.
   */
  protected globalOpStore: GlobalDataStore = {};

  /**
   * Main controller to allow global cancellation of the entire task flow.
   * All per-op controllers should eventually be tied to this as their parent,
   * or fallback to this if no specific controller is assigned yet.
   */
  protected mainAbortController = new AbortController();

  /**
   * Stores one AbortController per op.
   * Used to signal cancellation to all ops in a group or individually if needed.
   */
  protected abortControllerMap: Map<string, AbortController> = new Map();

  /**
   * Keeps track of the currently running group.
   * Useful for coordinating group-level logic or logging.
   */
  protected currentGroup: string | undefined;

  /**
   * keeps track of all promises of the current running group
   */
  protected currentGroupOperationsPromises: Map<string, Promise<void>> =
    new Map();

  /**
   * this is to create concurrency control on the operations
   */
  protected lockedOperations: Map<string, string> = new Map();

  /**
   * this is used to track the operations statuses
   */
  protected operationStatus: Map<
    string,
    (typeof OperationProgressStatuses)[keyof typeof OperationProgressStatuses]
  > = new Map();

  /**
   * this is to track event emitter to emit events
   */
  protected operationsEventEmitters: Map<string, EventEmitter> = new Map();

  /**
   * save log buffer for streaming logs
   */
  protected opLogBuffers: Map<string, TaskLog[]> = new Map();

  /**
   * this list of ws sub to the task managers events
   */
  protected subscribers: Set<WebSocket> = new Set();

  /**
   * stores filters
   */
  protected logMatchers: Map<WebSocket, (log: TaskLog) => boolean> = new Map();

  protected TOTAL_LOGS_COUNT: number = 0;

  /**
   * Lifecycle status of the task manager.
   * Can be 'init', 'running', 'stopped', or 'done'.
   */
  protected status: string = 'init';

  private currentRunningStartPromise?: Promise<void>;

  /**
   * Event emitter for task- and op-level lifecycle events.
   */
  protected events: EventEmitter = new EventEmitter();

  constructor(
    protected provider: Provider,
    protected repository: NodeRepository,
    protected job: string,
    protected project: string,
    protected definition?: JobDefinition,
  ) {
    if (definition) {
      this.operations = definition.ops;
    }

    this.runTaskManagerOperation = runTaskManagerOperation.bind(this);
    this.restartTaskManagerOperation = restartTaskManagerOperation.bind(this);
    this.stopTaskManagerOperation = stopTaskManagerOperation.bind(this);
    this.stopTaskManagerGroupOperations =
      stopTaskManagerGroupOperations.bind(this);
    this.restartTaskManagerGroupOperations =
      restartTaskManagerGroupOperations.bind(this);
    this.moveTaskManagerGroupOperations =
      moveTaskManagerGroupOperations.bind(this);
    this.stopAllTaskManagerOperations = stopAllTaskManagerOperations.bind(this);

    this.createOperationMap = createOperationMap.bind(this);
    this.createExecutionPlan = createExecutionPlan.bind(this);
    this.createDependencyMap = createDependencyMap.bind(this);
    this.validateExecutionPlan = validateExecutionPlan.bind(this);

    this.getOperationsStatus = getOperationsStatus.bind(this);
    this.getOperationStatus = getOperationStatus.bind(this);
    this.getCurrentGroup = getCurrentGroup.bind(this);
    this.getCurrentGroupStatus = getCurrentGroupStatus.bind(this);
    this.getGroupStatus = getGroupStatus.bind(this);

    this.addlog = addLog.bind(this);
    this.getLogsByOp = getLogsByOp.bind(this);
    this.getLogsByGroup = getLogsByGroup.bind(this);
    this.getAllLogs = getAllLogs.bind(this);
    this.subscribe = subscribe.bind(this);
    this.unsubscribe = unsubscribe.bind(this);

    this.setResult = setResult.bind(this);
    this.setResults = setResults.bind(this);
    this.setHost = setHost.bind(this);
    this.setDefaults = setDefaults.bind(this);
    this.rehydrateEndpointsForOperation =
      rehydrateEndpointsForOperation.bind(this);
    this.getByPath = getByPath.bind(this);
    this.resolveLiteralsInString = resolveLiteralsInString.bind(this);
    this.interpolate = interpolate.bind(this) as InterpolateFn;
    this.interpolateOperation = interpolateOperation.bind(
      this,
    ) as InterpolateOpFn;
    this.transformCollections = transformCollections.bind(
      this,
    ) as InterpolateOpFn;

    const sdk = getSDK();

    this.globalStore = {
      job,
      project,
      frps_address: configs().frp.serverAddr,
      host: sdk.solana.wallet.publicKey.toString(),
    };

    // Allow more listeners to account for many ops without warnings
    this.events.setMaxListeners(100);
  }

  // operations methods
  public runTaskManagerOperation: (
    flow: Flow,
    op: Operation<OperationType>,
    dependent: string[],
  ) => Promise<void>;
  public restartTaskManagerOperation: (
    group: string,
    opId: string,
  ) => Promise<void>;
  public stopTaskManagerOperation: (
    group: string,
    opId: string,
  ) => Promise<void>;
  public stopTaskManagerGroupOperations: (group: string) => Promise<void>;
  public restartTaskManagerGroupOperations: (group: string) => Promise<void>;
  public moveTaskManagerGroupOperations: (group: string) => Promise<void>;
  public stopAllTaskManagerOperations: (reason: StopReason) => void;

  // executions methods
  public createOperationMap: () => Map<string, Operation<OperationType>>;
  public createExecutionPlan: () => ExecutionContext[];
  public createDependencyMap: () => Map<string, DependencyContext>;
  public validateExecutionPlan: () => void;

  public getOperationsStatus: () => Record<string, string | null>;
  public getOperationStatus: (id: string) => Record<string, string | null>;
  public getCurrentGroup: () => string | undefined;
  public getCurrentGroupStatus: () => Record<string, string | null>;
  public getGroupStatus: (group: string) => Record<string, string | null>;

  public addlog: (log: TaskLog) => void;
  public getLogsByOp: (opid: string) => TaskLog[];
  public getLogsByGroup: (group: string) => TaskLog[];
  public getAllLogs: () => TaskLog[];
  public subscribe: (ws: WebSocket, matcher: (log: TaskLog) => boolean) => void;
  public unsubscribe: (ws: WebSocket) => void;

  public setResult: (opId: string, key: string, value: any) => void;
  public setResults: (opId: string, values: Record<string, any>) => void;
  public setHost: (opId: string, host: string) => void;
  public setDefaults: (
    flowId: string,
    project: string,
    jobDefinition: JobDefinition,
  ) => void;
  public rehydrateEndpointsForOperation: (
    flowId: string,
    project: string,
    jobDefinition: JobDefinition,
    opId: string,
  ) => void;
  public getByPath: (opId: string, path: string) => any;
  public resolveLiteralsInString: (input: string) => string;
  public interpolate: InterpolateFn;
  public interpolateOperation: InterpolateOpFn;
  public transformCollections: InterpolateOpFn;

  /**
   * Returns the unified event emitter for this task manager.
   */
  public getEventsEmitter(): EventEmitter {
    return this.events;
  }

  /**
   * Registers an op-level emitter and relays its relevant events to the
   * task-level unified emitter. Also tracks the emitter in operationsEventEmitters.
   */
  protected registerAndRelayOpEmitter(
    opId: string,
    emitter: EventEmitter,
  ): void {
    const existing = this.operationsEventEmitters.get(opId);
    if (existing && existing === emitter) return;
    const lifecycleEvents = new Set<string>([
      'start',
      'exit',
      'error',
      'updateOpState',
      'healthcheck:startup:success',
      'flow:secrets-updated',
    ]);
    const eventsToRegister: string[] = [...lifecycleEvents, 'log'];

    if (existing && existing !== emitter) {
      for (const eventName of eventsToRegister) {
        existing.removeAllListeners(eventName);
      }
    }

    emitter.setMaxListeners(50);

    const relay = (eventType: string) => (payload?: any) => {
      this.events.emit('op:event', { opId, type: eventType, payload });
      // For events that impact job-info payload, also emit flow:updated
      if (lifecycleEvents.has(eventType)) {
        this.events.emit('flow:updated', {
          jobId: this.job,
          opId,
          type: eventType,
        });
      }
    };

    for (const eventName of eventsToRegister) {
      emitter.on(eventName, relay(eventName));
    }

    this.operationsEventEmitters.set(opId, emitter);
    this.events.emit('op:emitter-registered', { opId });
  }

  /**
   * Prepares the TaskManager for execution by performing all necessary setup steps.
   *
   * This method performs two key operations:
   *
   *  `build()`:
   *    - Generates a map of all operations for fast lookup.
   *    - Creates the execution plan based on operation groups and dependencies.
   *    - Validates the structure of the plan to catch any misconfigurations early.
   *
   *  `init()`:
   *    - Initializes the task's persistent flow state in the repository.
   *    - Skips initialization if the flow already exists (resumable/restartable design).
   *
   * Call this once before `start()` to ensure the task manager is fully ready.
   */
  public bootstrap() {
    this.build(); // Set up opMap, executionPlan, and validate
    this.init(); // Create initial flow in the repository if it doesn't already exist

    // register all operations to init status
    [...this.opMap.keys()].forEach((op) =>
      this.operationStatus.set(op, OperationProgressStatuses.INIT),
    );
  }

  /**
   * Starts the execution of the job by processing each group in the execution plan.
   * Tracks the full lifecycle including flow state updates and dynamic operations.
   *
   * Execution Lifecycle:
   * - If already started, returns the tracked lifecycle promise.
   * - Sets status to 'running' and updates the repository with start time.
   * - Iterates through execution groups and runs each op concurrently.
   * - Uses a dynamic while-loop to ensure all ops (including restarts) finish before advancing.
   * - After all groups finish, updates the flow state to 'success' or keeps previous status.
   * - On any uncaught failure, marks the flow as 'failed' with end time.
   */
  public async start() {
    // Return the lifecycle promise if already running
    if (this.currentRunningStartPromise) return this.currentRunningStartPromise;

    // Track the entire execution lifecycle in one promise
    this.currentRunningStartPromise = (async () => {
      // Fetch existing flow to determine whether execution should continue
      const flow = this.repository.getFlow(this.job);

      try {
        // If job already ended (either success or failure), no need to start again
        // if (flow.state.endTime) return;

        // Mark as running and update DB
        this.status = 'running';

        this.repository.updateflowState(this.job, {
          status: this.status,
          startTime: Date.now(),
        });
        this.events.emit('flow:updated', {
          jobId: this.job,
          type: 'status:start',
        });

        // update all operations status to pending since we have started
        [...this.opMap.keys()].forEach((op) =>
          this.operationStatus.set(op, OperationProgressStatuses.PENDING),
        );

        // Loop through execution plan, group by group
        for (const p of this.executionPlan) {
          this.currentGroup = p.group;
          this.events.emit('flow:updated', {
            jobId: this.job,
            type: 'group:start',
            group: this.currentGroup,
          });

          // Queue each operation in the group for execution
          for (const id of p.ops) {
            const dependencyContext = this.dependecyMap.get(
              id,
            ) as DependencyContext;
            const dependencies = dependencyContext.dependencies || [];
            const depsSatisfied =
              dependencies.length === 0 ||
              dependencies.every((depId) => {
                const depStatus = this.operationStatus.get(depId);
                return (
                  depStatus === OperationProgressStatuses.FINISHED ||
                  depStatus === OperationProgressStatuses.STOPPED
                );
              });

            if (depsSatisfied) {
              this.operationStatus.set(id, OperationProgressStatuses.STARTING);

              this.currentGroupOperationsPromises.set(
                id,
                this.trackGroupOperationPromise(
                  id,
                  this.setUpOperationFunc(
                    flow,
                    id,
                    dependencyContext.dependents,
                  ),
                ),
              );
            } else {
              this.operationStatus.set(id, OperationProgressStatuses.WAITING);
            }
          }

          // push updated STARTING/WAITING statuses to listeners
          this.events.emit('flow:updated', {
            jobId: this.job,
            type: 'group:schedule',
            group: this.currentGroup,
          });

          try {
            /**
             * We use a `while` loop instead of a single `await Promise.all(...)` to handle dynamic group operations.
             *
             * Why:
             * - During execution, new operations (like restarted ops) can be added to `currentGroupOperationsPromises`.
             * - If we used a static `Promise.all(...)` outside the loop, it would only await the current snapshot,
             *   and any late-added promises wouldn't be awaited — leading to premature group advancement.
             *
             * This loop ensures:
             * - We await all operations in the group, including those dynamically inserted (e.g. from restarts).
             * - The group doesn't complete until all its tracked promises are settled and removed.
             */
            while (this.currentGroupOperationsPromises.size > 0) {
              await Promise.all([
                ...this.currentGroupOperationsPromises.values(),
              ]);
            }
          } finally {
            // Reset group state after completion. successful or not
            const finishedGroup = this.currentGroup;
            this.currentGroup = undefined;
            this.currentGroupOperationsPromises.clear();
            this.events.emit('flow:updated', {
              jobId: this.job,
              type: 'group:end',
              group: finishedGroup,
            });
          }
        }

        // If status is still 'running', mark the job as successful
        this.status = this.status === 'running' ? 'success' : this.status;

        this.repository.updateflowState(this.job, {
          status: this.status,
          endTime: Date.now(),
        });
        this.events.emit('flow:updated', {
          jobId: this.job,
          type: 'status:end',
        });
      } catch (error) {
        // Any uncaught failure sets the flow to 'failed'
        this.repository.updateflowState(this.job, {
          status: 'failed',
          endTime: Date.now(),
        });
        this.events.emit('flow:updated', {
          jobId: this.job,
          type: 'status:failed',
        });
      } finally {
        // Do a total operation clean up where we go through all the opmap and clean all operations
        const closingOperationPromises = [];

        for (const op of this.opMap.values()) {
          closingOperationPromises.push(
            this.provider.stopTaskManagerOperation(flow, op),
          );
        }

        await Promise.all(closingOperationPromises);
      }
    })();

    return this.currentRunningStartPromise;
  }

  /**
   * Gracefully stops the task manager and all its operations.
   *
   * This method:
   * - Immediately aborts all running operations by triggering the main abort controller.
   * - Waits for the current `start()` flow to finish, including database updates.
   * - Ensures `stop()` logic runs only once per job to prevent race conditions.
   *
   * Important:
   * - `stopAllTaskManagerOperations()` is synchronous and triggers cancellation.
   * - The actual cleanup and final state update (e.g., setting `endTime`) is handled
   *   by the `start()` method’s final logic.
   */
  public async stop(reason: StopReason): Promise<void> {
    const lockKey = `stop:${this.job}`;

    // Ensure stop logic runs only once per job
    if (this.lockedOperations.has(lockKey)) return;

    this.lockedOperations.set(lockKey, reason);

    try {
      // Immediately abort all running operations
      this.stopAllTaskManagerOperations(reason);

      // Wait for the ongoing start logic to gracefully complete
      if (this.currentRunningStartPromise) {
        try {
          await this.currentRunningStartPromise;
        } catch {
          // We ignore start errors during shutdown — cleanup should proceed regardless
        }
      }
    } finally {
      // Cleanup the lock regardless of outcome
      this.lockedOperations.delete(lockKey);
    }
  }

  protected setUpOperationFunc(
    flow: Flow,
    id: string,
    dependent: string[],
  ): Promise<void> {
    const op = this.opMap.get(id);
    if (!op) {
      throw new Error(`Invalid Op id: ${id}`);
    }

    return this.runTaskManagerOperation(flow, op, dependent);
  }

  protected trackGroupOperationPromise(
    opId: string,
    promise: Promise<void>,
  ): Promise<void> {
    this.currentGroupOperationsPromises.set(opId, promise);

    promise.finally(() => {
      this.currentGroupOperationsPromises.delete(opId);

      for (const [nextOpId, { execution }] of this.opMap) {
        if (
          !this.currentGroup ||
          !execution ||
          !execution.depends_on ||
          !execution.stop_if_dependent_stops
        )
          continue;

        if (execution.depends_on.includes(opId)) {
          this.stopTaskManagerOperation(this.currentGroup, nextOpId);
        }
      }
    });

    return promise;
  }

  protected getStatus(reason: StopReason, type: 'ops' | 'flow'): Status {
    const map: Record<StopReason, { ops: Status; flow: Status }> = {
      [StopReasons.COMPLETED]: {
        ops: Statuses.SUCCESS,
        flow: Statuses.SUCCESS,
      },
      [StopReasons.EXPIRED]: { ops: Statuses.SUCCESS, flow: Statuses.SUCCESS },
      [StopReasons.STOPPED]: { ops: Statuses.STOPPED, flow: Statuses.STOPPED },
      [StopReasons.RESTART]: { ops: Statuses.STOPPED, flow: Statuses.STOPPED },
      [StopReasons.QUIT]: { ops: Statuses.FAILED, flow: Statuses.FAILED },
      [StopReasons.UNKNOWN]: { ops: Statuses.FAILED, flow: Statuses.FAILED },
    };

    return map[reason][type];
  }

  protected getOpStateIndex(opId: string): number {
    const index = (this.operations as TaskManagerOps).findIndex(
      (op) => op.id === opId,
    );

    if (index === -1) {
      throw new Error(`Operation not found for ID: ${opId}`);
    }

    return index;
  }

  private build() {
    this.opMap = this.createOperationMap();
    this.validateExecutionPlan();
    this.executionPlan = this.createExecutionPlan();
    this.dependecyMap = this.createDependencyMap();
  }

  private init(): void {
    const flow = this.repository.getFlow(this.job);
    if (flow && flow.state.status !== 'waiting-for-job-definition') {
      this.definition = flow.jobDefinition;
    } else {
      const now = Date.now();

      const flow = createInitialFlow(
        this.job,
        this.project,
        this.definition as JobDefinition,
        this.operations as TaskManagerOps,
        this.status,
        now,
      );

      this.repository.setflow(this.job, flow);
      this.setDefaults(flow.id, this.project, this.definition!);
    }

    if (!this.definition) {
      throw new Error('Job Definition Not Specified');
    }
  }
}
