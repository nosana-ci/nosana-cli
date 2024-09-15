export const NODE_STATE_NAME = {
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

export type NodeState = (typeof NODE_STATE_NAME)[keyof typeof NODE_STATE_NAME];

export type NodeStartingData = {
    node: string;
}

export type NodeStartedData = {
    node: string;
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

export type NodeStateData = {
    [NODE_STATE_NAME.NODE_STARTING]: NodeStartingData;
    [NODE_STATE_NAME.NODE_STARTED]: NodeStartedData;
    [NODE_STATE_NAME.HEALTH_CHECK_STARTING]: HealthCheckStartingData;
    [NODE_STATE_NAME.HEALTH_CHECK_RUNNING]: HealthCheckRunningData;
    [NODE_STATE_NAME.HEALTH_CHECK_PASSED]: HealthCheckPassedData;
    [NODE_STATE_NAME.HEALTH_CHECK_FAILED]: HealthCheckFailedData;
    [NODE_STATE_NAME.BENCHMARK_STARTING]: BenchmarkStartingData;
    [NODE_STATE_NAME.BENCHMARK_RUNNING]: BenchmarkRunningData;
    [NODE_STATE_NAME.BENCHMARK_PASSED]: BenchmarkPassedData;
    [NODE_STATE_NAME.BENCHMARK_FAILED]: BenchmarkFailedData;
    [NODE_STATE_NAME.JOINING_QUEUE]: JoiningQueueData;
    [NODE_STATE_NAME.JOINING_QUEUE_PASSED]: JoiningQueuePassedData;
    [NODE_STATE_NAME.JOINING_QUEUE_FAILED]: JoiningQueueFailedData;
    [NODE_STATE_NAME.JOB_STARTING]: JobStartingData;
    [NODE_STATE_NAME.JOB_STARTING_PASSED]: JobStartingPassedData;
    [NODE_STATE_NAME.JOB_STARTING_FAILED]: JobStartingFailedData;
    [NODE_STATE_NAME.JOB_RUNNING]: JobRunningData;
    [NODE_STATE_NAME.JOB_COMPLETED]: JobCompletedData;
    [NODE_STATE_NAME.JOB_STOPPED]: JobStoppedData;
    [NODE_STATE_NAME.JOB_FAILED]: JobFailedData;
    [NODE_STATE_NAME.IDLE]: IdleData;
    [NODE_STATE_NAME.UPDATING]: UpdatingData;
    [NODE_STATE_NAME.RESTARTING]: RestartingData;
    [NODE_STATE_NAME.SHUTTING_DOWN]: ShuttingDownData;
    [NODE_STATE_NAME.NONE]: NoneData;
};
