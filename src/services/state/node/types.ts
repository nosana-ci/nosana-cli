export const NODE_STATE_NAME = {
  NODE_STARTING: 'NODE_STARTING',
  NODE_STARTED: 'NODE_STARTED',

  PROVIDER_HEALTH_CHECKING: 'PROVIDER_HEALTH_CHECKING',
  PROVIDER_HEALTH_PASSED: 'PROVIDER_HEALTH_PASSED',
  PROVIDER_HEALTH_FAILED: 'PROVIDER_HEALTH_FAILED',

  API_SERVER_STARTING: 'API_SERVER_STARTING',
  API_SERVER_STARTED: 'API_SERVER_STARTED',
  API_SERVER_FAILED: 'API_SERVER_FAILED',

  HEALTH_CHECK_STARTING: 'HEALTH_CHECK_STARTING',
  HEALTH_CHECK_RUNNING: 'HEALTH_CHECK_RUNNING',
  HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',

  BENCHMARK_STARTING: 'BENCHMARK_STARTING',
  BENCHMARK_RUNNING: 'BENCHMARK_RUNNING',
  BENCHMARK_PASSED: 'BENCHMARK_PASSED',
  BENCHMARK_FAILED: 'BENCHMARK_FAILED',

  RETRIVING_MARKET: 'RETRIVING_MARKET',
  RETRIVING_MARKET_PASSED: 'RETRIVING_MARKET_PASSED',
  RETRIVING_MARKET_FAILED: 'RETRIVING_MARKET_FAILED',

  JOINING_QUEUE: 'JOINING_QUEUE',
  JOINED_QUEUE: 'JOINED_QUEUE',
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
  NONE: 'NONE',
} as const;

export type NodeState = (typeof NODE_STATE_NAME)[keyof typeof NODE_STATE_NAME];

export type NodeStartingData = {
  node: string;
};

export type NodeStartedData = {
  node: string;
};

export type ProviderHealthCheckingData = {
  node: string;
};

export type ProviderHealthPassedData = {
  node: string;
};

export type ProviderHealthfailedData = {
  node: string;
  error: Error;
};

export type ApiServerStartingData = {
  node: string;
};

export type ApiServerStartedData = {
  node: string;
};

export type ApiServerFailedData = {
  node: string;
  error: Error;
};

export type HealthCheckStartingData = {
  node: string;
  market: string;
};

export type HealthCheckRunningData = {
  node: string;
  market: string;
};

export type HealthCheckPassedData = {
  node: string;
  market: string;
};

export type HealthCheckFailedData = {
  node: string;
  market: string;
  error: Error;
};

export type BenchmarkStartingData = {
  benchmarkName: string;
};

export type BenchmarkRunningData = {
  node: string;
};

export type BenchmarkPassedData = {
  node: string;
};

export type BenchmarkFailedData = {
  node: string;
  error: Error;
  errors: any[];
};

export type RetrivingMarketData = {
  node: string;
  market: string;
};

export type RetrivingMarketPassedData = {
  node: string;
  market: string;
};

export type RetrivingMarketFailedData = {
  node: string;
  market: string;
  error: Error;
};

export type JoiningQueueData = {
  node: string;
  market: string;
};

export type JoinedQueueData = {
  node: string;
  market: string;
};

export type JoiningQueuePassedData = {
  node: string;
  market: string;
};

export type JoiningQueueFailedData = {
  node: string;
  market: string;
  error: Error;
};

export type JobStartingData = {
  node: string;
  market: string;
  job: string;
};

export type JobStartingPassedData = {
  node: string;
  market: string;
  job: string;
};

export type JobStartingFailedData = {
  node: string;
  market: string;
  job: string;
  error: Error;
};

export type JobRunningData = {
  node: string;
  market: string;
  job: string;
};

export type JobFailedData = {
  node: string;
  market: string;
  job: string;
  error: Error;
};

export type JobCompletedData = {
  node: string;
  market: string;
  job: string;
  status?: string;
};

export type JobStoppedData = {
  node: string;
  market: string;
  job: string;
};

export type IdleData = {
  lastActiveAt: Date;
};

export type UpdatingData = {
  updateVersion: string;
  updateStartedAt: Date;
};

export type RestartingData = {
  node: string;
};

export type ShuttingDownData = {
  reason: string;
  shutdownInitiatedAt: Date;
};

export type NoneData = {};

export type NodeStateData = {
  [NODE_STATE_NAME.NODE_STARTING]: NodeStartingData;
  [NODE_STATE_NAME.NODE_STARTED]: NodeStartedData;

  [NODE_STATE_NAME.PROVIDER_HEALTH_CHECKING]: ProviderHealthCheckingData;
  [NODE_STATE_NAME.PROVIDER_HEALTH_PASSED]: ProviderHealthPassedData;
  [NODE_STATE_NAME.PROVIDER_HEALTH_FAILED]: ProviderHealthfailedData;

  [NODE_STATE_NAME.API_SERVER_STARTING]: ApiServerStartingData;
  [NODE_STATE_NAME.API_SERVER_STARTED]: ApiServerStartedData;
  [NODE_STATE_NAME.API_SERVER_FAILED]: ApiServerFailedData;

  [NODE_STATE_NAME.HEALTH_CHECK_STARTING]: HealthCheckStartingData;
  [NODE_STATE_NAME.HEALTH_CHECK_RUNNING]: HealthCheckRunningData;
  [NODE_STATE_NAME.HEALTH_CHECK_PASSED]: HealthCheckPassedData;
  [NODE_STATE_NAME.HEALTH_CHECK_FAILED]: HealthCheckFailedData;

  [NODE_STATE_NAME.BENCHMARK_STARTING]: BenchmarkStartingData;
  [NODE_STATE_NAME.BENCHMARK_RUNNING]: BenchmarkRunningData;
  [NODE_STATE_NAME.BENCHMARK_PASSED]: BenchmarkPassedData;
  [NODE_STATE_NAME.BENCHMARK_FAILED]: BenchmarkFailedData;

  [NODE_STATE_NAME.RETRIVING_MARKET]: RetrivingMarketData;
  [NODE_STATE_NAME.RETRIVING_MARKET_PASSED]: RetrivingMarketPassedData;
  [NODE_STATE_NAME.RETRIVING_MARKET_FAILED]: RetrivingMarketFailedData;

  [NODE_STATE_NAME.JOINING_QUEUE]: JoiningQueueData;
  [NODE_STATE_NAME.JOINED_QUEUE]: JoinedQueueData;
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
