export enum StateCategory {
  RUNNING_JOB = 'RUNNING_JOB',
  BENCHMARKING = 'BENCHMARKING',
  HEALTHCHECK = 'HEALTHCHECK',
  RESTARTING = 'RESTARTING',
  STARTING = 'STARTING',
  JOINING_MARKET = 'JOINING_MARKET',
  QUEUED = 'QUEUED',
  OTHER = 'OTHER',
}

export const stateClassificationMap: { [key: string]: StateCategory } = {
  // RUNNING JOB states
  'job-running': StateCategory.RUNNING_JOB,
  'job-running-success': StateCategory.RUNNING_JOB,
  'job-running-failed': StateCategory.RUNNING_JOB,
  'claiming-job': StateCategory.RUNNING_JOB,
  'claiming-job-success': StateCategory.RUNNING_JOB,
  'claiming-job-failed': StateCategory.RUNNING_JOB,
  'job-starting': StateCategory.RUNNING_JOB,
  'job-starting-success': StateCategory.RUNNING_JOB,
  'job-starting-failed': StateCategory.RUNNING_JOB,
  'awaiting-job-definition': StateCategory.RUNNING_JOB,
  'awaiting-job-definition-success': StateCategory.RUNNING_JOB,
  'awaiting-job-definition-failed': StateCategory.RUNNING_JOB,
  'job-resuming': StateCategory.RUNNING_JOB,
  'job-finishing': StateCategory.RUNNING_JOB,
  'job-finishing-success': StateCategory.RUNNING_JOB,
  'job-finishing-failed': StateCategory.RUNNING_JOB,

  // BENCHMARKING states
  'benchmark-running': StateCategory.BENCHMARKING,
  'benchmark-passed': StateCategory.BENCHMARKING,
  'benchmark-failed': StateCategory.BENCHMARKING,

  // HEALTHCHECK states
  'health-check-running': StateCategory.HEALTHCHECK,
  'health-check-failed': StateCategory.HEALTHCHECK,

  // RESTARTING states
  'node-restarting': StateCategory.RESTARTING,
  'node-restarted': StateCategory.RESTARTING,

  // STARTING states
  'node-starting': StateCategory.STARTING,
  'node-starting-failed': StateCategory.STARTING,
  'node-started': StateCategory.STARTING,

  // JOINING MARKET states
  'queueing-in-market': StateCategory.JOINING_MARKET,
  'queueing-in-market-success': StateCategory.QUEUED,
  'queueing-in-market-failed': StateCategory.QUEUED,
  'queueing-in-market-position': StateCategory.QUEUED,

  // QUEUED states
  'awaiting-job-queue': StateCategory.QUEUED,
  'job-queued': StateCategory.QUEUED,

  // Add other mappings here as needed
};

// Function to classify a state based on its status string
export function classifyState(status: string): StateCategory {
  return stateClassificationMap[status] || StateCategory.OTHER;
}
