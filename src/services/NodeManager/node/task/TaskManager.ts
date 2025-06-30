import { Flow, JobDefinition, OperationArgsMap, OperationResults, OperationType } from "@nosana/sdk";
import { NodeRepository } from "../../repository/NodeRepository.js";
import { Provider } from "../../provider/Provider.js";
import EventEmitter from "events";
import { extractLogsAndResultsFromLogBuffer } from "../../../../providers/utils/extractLogsAndResultsFromLogBuffer.js";

export type Operation<T extends OperationType> = {
    type: OperationType;
    id: string;
    args: OperationArgsMap[T];
    results?: OperationResults;
    execution?: Execution;
};

export type TaskManagerOps = Array<Operation<OperationType>>;

type Execution = {
    group?: string,
    depends_on?: string[]
}

type ExecutionContext = {
  group: string;
  ops: string[];
};

export const StopReasons = {
  EXPIRED: 'expired',
  STOPPED: 'stopped',
  QUIT: 'quit',
  UNKNOWN: 'unknown',
} as const;

export type StopReason = typeof StopReasons[keyof typeof StopReasons];

export const Statuses = {
  SUCCESS: 'success',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;

export type Status = typeof Statuses[keyof typeof Statuses];

export default class TaskManager {
    /** 
     * All operations defined in the Job Definition (JD).
     */
    private operations: TaskManagerOps;

    /** 
     * The ordered execution plan built from the job definition.
     * Each item represents a group of ops that run together horizontally.
     */
    private executionPlan: ExecutionContext[] = [];

    /** 
     * A map for fast lookup of operations by their ID.
     * Useful during validation and execution.
     */
    private opMap: Map<string, Operation<OperationType>> = new Map();

    /** 
     * Main controller to allow global cancellation of the entire task flow.
     * All per-op controllers should eventually be tied to this as their parent,
     * or fallback to this if no specific controller is assigned yet.
     */
    private mainAbortController = new AbortController();

    /**
     * Stores one AbortController per op.
     * Used to signal cancellation to all ops in a group or individually if needed.
     */
    private abortControllerMap: Map<string, AbortController> = new Map();

    /**
     * Keeps track of the currently running group.
     * Useful for coordinating group-level logic or logging.
     */
    private currentGroup: string | undefined;

    /**
     * Lifecycle status of the task manager.
     * Can be 'init', 'running', 'stopped', or 'done'.
     */
    private status: string = "init";

    constructor(
        private provider: Provider, 
        private repository: NodeRepository, 
        private definition: JobDefinition, 
        private job: string) {
        this.operations = definition.ops
    }

    public buildExecutionPlan() {
        // make a opMap key value map of the id to the operation
        this.opMap = this.createOpMap();

        // convert the operation into an execution plan
        this.executionPlan = this.createExecutionPlan();

        // validate all the execution plan
        this.validateExecutionPlan()
    }

    public init() {
        let flow = this.repository.getflow(this.job);

        // check if this node has history of this flow, if it does then return meaning do no initialize new
        if(flow) {
            return
        }

        // set the initial flow of the job
        flow = {
            id: this.job,
            jobDefinition: this.definition,
            state: {
                status: this.status,
                startTime: Date.now(), // this is a dummy time, this will be changed
                endTime: null,
                opStates: [],
                secrets: {},
            },
        };

        // loop through the operations and init each op's opstate
        for (const op of this.operations) {
            flow.state.opStates.push({
                operationId: op.id,
                providerId: null,
                status: 'init',
                startTime: null,
                endTime: null,
                exitCode: null,
                logs: [],
            });
        }

        // set the flow in the database
        this.repository.setflow(this.job, flow);
    }

    public async run() {
        try {
            // start the flow and set the new start time
            let flow = this.repository.getflow(this.job);

            // check if the flow is already failed or finished, we don't need to check the status endtime is enough
            if(flow.state.endTime) {
                return
            }

            // set the flow to running because the task has started
            this.status = "running"

            this.repository.updateflowState(this.job, { status: this.status, startTime: Date.now() });

            // using the execution context we want to start from the first op
            for(const p of this.executionPlan){
                // set current group to the current working group in the loop
                this.currentGroup = p.group;

                // set an abort controller for the group that makes sure all first together (we might not need this now)
                // const groupAbort = new AbortController();

                // before going ahead to start we want to check if any of the ops in the group has failed or ended
                // this will facilitate group fail (if we want group fail, but we might not need this now)
                // let groupMemberHasEnded = flow.state.opStates.some(opState =>
                //     p.ops.includes(opState.operationId as string) && opState.endTime !== null
                // );
                
                // now time to run all the op in the execution plan ops array
                // start running all the ops in this group simultanously
                const promises: Promise<void>[] = [];

                // use promise.all to start every in this group
                for(const id of p.ops){
                    const op = this.opMap.get(id)

                    if(!op) {
                        throw new Error(`Invalid Op id; ${id}`)
                    }

                    // check if the current opState has ended
                    if(this.repository.getOpState(this.job, this.getOpStateIndex(id)).endTime){
                        // set that a group member has ended so all members can end also
                        // groupMemberHasEnded = true;

                        // end this iteration because the work here is done
                        continue; 
                    }

                    // if any group member as ended then we might want to end this also (we don't need this now)
                    // if(groupMemberHasEnded) {
                    //     // set the op to stopped
                    //     this.repository.updateOpState(this.job, this.getOpStateIndex(id), { status: 'stopped', endTime: Date.now() })

                    //     // end the loop and move to the next ops and the that would also end but the ops will be updated
                    //     continue;
                    // }

                    const emitter = new EventEmitter();
                    const abort = this.createAbortControllerForOp(id);

                    // Wire up listener to collect logs, update state, and exit.
                    emitter.on('log', (log) => this.repository.updateOpStateLogs(this.job, this.getOpStateIndex(id), log));

                    emitter.on('updateOpState', (body) => this.repository.updateOpState(this.job, this.getOpStateIndex(id), body));

                    emitter.on('start', () => this.repository.updateOpState(this.job, this.getOpStateIndex(id), { status: 'running', startTime: Date.now() }));
                    
                    emitter.on('exit', ({ exitCode }) => {
                        const signal = abort.signal;
                        const wasAborted = signal.aborted;
                        const reason = wasAborted ? signal.reason : undefined;

                        const status = wasAborted
                            ? this.getStatus(reason, 'ops')
                            : exitCode === 0
                            ? 'success'
                            : 'failed';

                        // convert logs to buffer
                        const combinedBuffer = Buffer.concat((this.repository.getOpState(this.job, this.getOpStateIndex(id)).logs).map(log => Buffer.from(log as unknown as string, 'utf-8')));

                        // extract results and log from log buffer
                        const { logs, results } = extractLogsAndResultsFromLogBuffer(combinedBuffer, op.results);

                        this.repository.updateOpState(this.job, this.getOpStateIndex(id), {
                            logs,
                            results,
                            exitCode,
                            endTime: Date.now(),
                            status,
                        });
                    });

                    // we want to be able to check if this was aborted and if it was aborted get the reason and pass it to the getStatus to get the real status
                    // but if it wasn't aborted do the normal exitCode === 0 ? 'success' : 'failed'
                    
                    emitter.on('error', (err) => {
                        const signal = abort.signal;
                        const wasAborted = signal.aborted;
                        const reason = wasAborted ? signal.reason : undefined;

                        const status = wasAborted ? this.getStatus(reason, 'ops') : 'failed';

                        // we might need this but this is going to be for another log and not the container logs
                        // if(wasAborted){
                        //     this.repository.updateOpStateLogs(this.job, this.getOpStateIndex(id), { log: `operation ${op.id} was ${reason}`, type: 'nodeerr' })
                        // }

                        // convert logs to buffer
                        const combinedBuffer = Buffer.concat((this.repository.getOpState(this.job, this.getOpStateIndex(id)).logs).map(log => Buffer.from(log as unknown as string, 'utf-8')));

                        // extract results and log from log buffer
                        const { logs, results } = extractLogsAndResultsFromLogBuffer(combinedBuffer, op.results);

                        this.repository.updateOpState(this.job, this.getOpStateIndex(id), {
                            results,
                            logs,
                            exitCode: 2,
                            status: status,
                            endTime: Date.now(),
                        });
                    });

                    // we want to close all and clean up all container. volumes and other stuffs of an ops after it ends, weither success or failure
                    emitter.on('end', async () => {
                        // this will clean up behind the scenes
                        await this.provider.taskManagerContainerStopRunOperation(flow, op as Operation<'container/run'>)

                        // what else can we clean up here?
                    })
                    
                    emitter.on('healthcheck:success', () => {})

                    // push all the promises to the array so we can start all at once
                    promises.push(this.provider.taskManagerContainerRunOperation(flow, op as Operation<'container/run'>, abort, emitter));
                    
                    // if(this.stopped) {
                    //     // set the op to stopped
                    //     this.repository.updateOpState(this.job, this.getOpStateIndex(id), { status: 'stopped', endTime: Date.now() })

                    //     // end the loop and move to the next ops and the that would also end but the ops will be updated
                    //     continue;
                    // }

                }

                try {
                    // start all promises
                    await Promise.all(promises);
                } catch(error) {
                    continue; // move to next group
                }
            }

            // we want to check if the status was changed from running, if it wasn't then change to success else leave at the new value
            this.status = this.status == 'running' ? 'success' : this.status

            this.repository.updateflowState(this.job, { status: this.status, endTime: Date.now() });
        } catch (error) {
            this.repository.updateflowState(this.job, { status: 'failed', endTime: Date.now() });
        }
    }

    public stop(reason: StopReason) {
        /**
         * There are multiple reasons why a job may be or has been stopped. This determines the status
         * that each op and the overall flow state should reflect.
         * 
         * | Reason   | Ops Status | Flow Status |
         * |----------|------------|-------------|
         * | expired  | success    | success     |
         * | stopped  | stopped    | stopped     |
         * | quit     | failed     | failed      |
         * | unknown  | failed     | failed      |
         * 
         * the getStatus simplifies this and gives you the appropiate service
         */
        this.status = this.getStatus(reason, "flow");

        this.mainAbortController.abort(reason)
    }

    private getStatus(reason: StopReason, type: 'ops' | 'flow'): Status {
        const map: Record<StopReason, { ops: Status; flow: Status }> = {
            [StopReasons.EXPIRED]: { ops: Statuses.SUCCESS, flow: Statuses.SUCCESS },
            [StopReasons.STOPPED]: { ops: Statuses.STOPPED, flow: Statuses.STOPPED },
            [StopReasons.QUIT]:    { ops: Statuses.FAILED, flow: Statuses.FAILED },
            [StopReasons.UNKNOWN]: { ops: Statuses.FAILED, flow: Statuses.FAILED },
        };

        return map[reason][type];
    }

    private createOpMap(): Map<string, Operation<OperationType>> {
        const map = new Map<string, Operation<OperationType>>();
        const duplicates: string[] = [];

        for (const op of this.operations) {
            if (map.has(op.id)) {
                duplicates.push(op.id);
            } else {
                map.set(op.id, op);
            }
        }

        if (duplicates.length > 0) {
            throw new Error(`Duplicate operation IDs found: ${duplicates.join(", ")}`);
        }

        return map;
    }

    private createExecutionPlan(): ExecutionContext[] {
        const groups = new Map<string, string[]>();

        for (const op of this.operations) {
            let groupName: string;

            // If op has a group, use it
            if (op.execution?.group) {
                groupName = op.execution.group;
            } else {
                // treat op ID as its own group (horizontal solo op)
                groupName = op.id;
            }

            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }

            groups.get(groupName)!.push(op.id);
        }

        // maintain insertion order
        const result: ExecutionContext[] = [];

        for (const [group, ops] of groups.entries()) {
            result.push({ group, ops });
        }

        return result;
    }

    private validateExecutionPlan() {
        const errors: string[] = [];

        for (const op of this.operations) {
            const opId = op.id;
            const dependsOn = op.execution?.depends_on ?? [];

            // check self dependency
            if (dependsOn.includes(opId)) {
                errors.push(`Invalid dependency: Operation '${opId}' cannot depend on itself.`);
            }

            for (const depId of dependsOn) {
                const depOp = this.opMap.get(depId);

                // missing dependency
                if (!depOp) {
                    errors.push(`Invalid dependency: Operation '${opId}' depends on non existent op '${depId}'.`);
                    continue;
                }

                // cross group dependency
                const opGroup = op.execution?.group;
                const depGroup = depOp.execution?.group;

                if (opGroup !== depGroup) {
                    errors.push(
                        `Invalid dependency: '${opId}' in group '${opGroup}' depends on '${depId}' in group '${depGroup}'`
                    );
                }
            }
        }

        if (errors.length > 0) {
            throw new Error("Execution Plan Validation Failed:\n" + errors.map(e => `- ${e}`).join("\n"));
        }
    }

    private getOpStateIndex(opId: string): number {
        const index = this.operations.findIndex(op => op.id === opId);

        if (index === -1) {
            throw new Error(`Operation not found for ID: ${opId}`);
        }

        return index;
    }

    private createAbortControllerForOp(opId: string): AbortController {
        const controller = new AbortController();

        this.mainAbortController.signal.addEventListener("abort", () => {
            controller.abort(this.mainAbortController.signal.reason);
        });

        this.abortControllerMap.set(opId, controller);
        return controller;
    }
}