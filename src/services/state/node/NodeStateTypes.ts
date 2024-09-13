export const STATE_NAME = {
    NODE_STARTING: 'NODE_STARTING',
    NODE_STARTED: 'NODE_STARTED',

    HEALTH_CHECK_STARTING: 'HEALTH_CHECK_STARTING',
    HEALTH_CHECK_RUNNING: 'HEALTH_CHECK_RUNNING',
    HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
    HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',

    BENCHMARK_STARTING: 'BENCHMARK_STARTING',
    BENCHMARK_RUNNING: 'BENCHMARK_RUNNING',
    BENCHMARK_PASSED: 'BENCHMARK_PASSED',
    BENCHMARK_FAILED: 'BENCHMARK_FAILED',

    JOINING_QUEUE: 'JOINING_QUEUE',
    JOINING_QUEUE_PASSED: 'JOINING_QUEUE_PASSED',
    JOINING_QUEUE_FAILED: 'JOINING_QUEUE_FAILED',

    JOB_STARTING: 'JOB_STARTING',
    JOB_STARTING_PASSED: 'JOB_STARTING_PASSED',
    JOB_STARTING_FAILED: 'JOB_STARTING_FAILED',
    JOB_RUNNING: 'JOB_RUNNING',
    JOB_COMPLETED: 'JOB_COMPLETED',
    JOB_STOPPED: 'JOB_STOPPED',
    JOB_FAILED: 'JOB_FAILED',

    IDLE: 'IDLE',
    UPDATING: 'UPDATING',
    RESTARTING: 'RESTARTING',
    SHUTTING_DOWN: 'SHUTTING_DOWN',
    NONE: 'NONE'
} as const;

export type State = (typeof STATE_NAME)[keyof typeof STATE_NAME];

export type StateHistoryEntry = {
    state: State,
    data: StateData[State]
    timestamp: Date
}

// Define specific types of data for each state
export type NodeStartingData = {
    message: string;
}

export type NodeStartedData = {
    startedAt: Date;
}

export type HealthCheckStartingData = {
    message: string;
}

export type HealthCheckRunningData = {
    progress: number;
}

export type HealthCheckPassedData = {
    passedAt: Date;
}

export type HealthCheckFailedData = {
    errorCode: number;
    errorMessage: string;
}

export type BenchmarkStartingData = {
    benchmarkName: string;
}

export type BenchmarkRunningData = {
    progress: number;
}

export type BenchmarkPassedData = {
    result: string;
}

export type BenchmarkFailedData = {
    errorCode: number;
    errorMessage: string;
}

export type JoiningQueueData = {
    queueId: string;
}

export type JoiningQueuePassedData = {
    queueId: string;
    joinedAt: Date;
}

export type JoiningQueueFailedData = {
    queueId: string;
    errorCode: number;
    errorMessage: string;
}

export type JobStartingData = {
    jobId: string;
}

export type JobStartingPassedData = {
    queueId: string;
    joinedAt: Date;
}

export type JobStartingFailedData = {
    queueId: string;
    errorCode: number;
    errorMessage: string;
}

export type JobRunningData = {
    jobId: string;
    progress: number;
}

export type JobFailedData = {
    jobId: string;
    errorCode: number;
    errorMessage: string;
}

export type JobCompletedData = {
    jobId: string;
    completedAt: Date;
}

export type JobStoppedData = {
    jobId: string;
    stoppedAt: Date;
    reason: string;
}

export type IdleData = {
    lastActiveAt: Date;
}

export type UpdatingData = {
    updateVersion: string;
    updateStartedAt: Date;
}

export type RestartingData = {
    reason: string;
    restartInitiatedAt: Date;
}

export type ShuttingDownData = {
    reason: string;
    shutdownInitiatedAt: Date;
}

export type NoneData = {}

export type StateData = {
    [STATE_NAME.NODE_STARTING]: NodeStartingData;
    [STATE_NAME.NODE_STARTED]: NodeStartedData;
    [STATE_NAME.HEALTH_CHECK_STARTING]: HealthCheckStartingData;
    [STATE_NAME.HEALTH_CHECK_RUNNING]: HealthCheckRunningData;
    [STATE_NAME.HEALTH_CHECK_PASSED]: HealthCheckPassedData;
    [STATE_NAME.HEALTH_CHECK_FAILED]: HealthCheckFailedData;
    [STATE_NAME.BENCHMARK_STARTING]: BenchmarkStartingData;
    [STATE_NAME.BENCHMARK_RUNNING]: BenchmarkRunningData;
    [STATE_NAME.BENCHMARK_PASSED]: BenchmarkPassedData;
    [STATE_NAME.BENCHMARK_FAILED]: BenchmarkFailedData;
    [STATE_NAME.JOINING_QUEUE]: JoiningQueueData;
    [STATE_NAME.JOINING_QUEUE_PASSED]: JoiningQueuePassedData;
    [STATE_NAME.JOINING_QUEUE_FAILED]: JoiningQueueFailedData;
    [STATE_NAME.JOB_STARTING]: JobStartingData;
    [STATE_NAME.JOB_STARTING_PASSED]: JobStartingPassedData;
    [STATE_NAME.JOB_STARTING_FAILED]: JobStartingFailedData;
    [STATE_NAME.JOB_RUNNING]: JobRunningData;
    [STATE_NAME.JOB_COMPLETED]: JobCompletedData;
    [STATE_NAME.JOB_STOPPED]: JobStoppedData;
    [STATE_NAME.JOB_FAILED]: JobFailedData;
    [STATE_NAME.IDLE]: IdleData;
    [STATE_NAME.UPDATING]: UpdatingData;
    [STATE_NAME.RESTARTING]: RestartingData;
    [STATE_NAME.SHUTTING_DOWN]: ShuttingDownData;
    [STATE_NAME.NONE]: NoneData;
};
