export const StatusNames = {
    // Node Status
    NODE_STARTING: 'NODE_STARTING',
    NODE_STARTED: 'NODE_STARTED',
  
    // Health Check Status
    HEALTH_CHECK_STARTING: 'HEALTH_CHECK_STARTING',
    HEALTH_CHECK_RUNNING: 'HEALTH_CHECK_RUNNING',
    HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
    HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  
    // Benchmark Status
    BENCHMARK_STARTING: 'BENCHMARK_STARTING',
    BENCHMARK_RUNNING: 'BENCHMARK_RUNNING',
    BENCHMARK_PASSED: 'BENCHMARK_PASSED',
    BENCHMARK_FAILED: 'BENCHMARK_FAILED',
  
    // Queue Status
    JOINING_QUEUE: 'JOINING_QUEUE',
    JOINING_QUEUE_PASSED: 'JOINING_QUEUE_PASSED',
    JOINING_QUEUE_FAILED: 'JOINING_QUEUE_FAILED',
  
    // Job Status
    JOB_RUNNING: 'JOB_RUNNING',
    JOB_STARTING: 'JOB_STARTING',
    JOB_COMPLETED: 'JOB_COMPLETED',
    JOB_STOPPED: 'JOB_STOPPED',
    JOB_FAILED: 'JOB_FAILED',
  
    // Miscellaneous Status
    IDLE: 'IDLE',
    UPDATING: 'UPDATING',
    RESTARTING: 'RESTARTING',
    SHUTTING_DOWN: 'SHUTTING_DOWN',
    NONE: 'NONE'
  } as const;
  
export type StatusName = typeof StatusNames[keyof typeof StatusNames];
  
export interface Status {
    name: StatusName;
    start: Date;
    stop?: Date;
}

export interface ApiInfo {
    url: string;
    active: boolean;
}

export interface JobInfo {
    name: string;
    start: Date;
    stop?: Date;
}

export interface NodeInfo {
    address: string;
    market: string;
    job: JobInfo;
    api: ApiInfo;
}

export interface State {
    status: Status;
    info?: NodeInfo;
    createdAt: Date;
}

export class NodeState {
    private state: State;

    constructor(initialState: State) {
        this.state = {
            ...initialState,
            createdAt: new Date(),
            status: {
                name: initialState.status.name,
                start: new Date(),
            },
        };
    }

    public endCurrentStatus(): void {
        this.state.status.stop = new Date();
    }

    public updateStatus(newStatusName: StatusName): void {
        this.state.status = {
            name: newStatusName,
            start: new Date(),
        };
    }

    public getState(): State {
        return this.state;
    }
}
