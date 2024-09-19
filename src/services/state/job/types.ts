export const JOB_STATE_NAME = {
  PULLING_IMAGE: 'PULLING_IMAGE',
  PULLING_IMAGE_SUCCESS: 'PULLING_IMAGE_SUCCESS',
  PULLING_IMAGE_FAILED: 'PULLING_IMAGE_FAILED',

  CREATING_VOLUME: 'CREATING_VOLUME',
  CREATING_VOLUME_SUCCESS: 'CREATING_VOLUME_SUCCESS',
  CREATING_VOLUME_FAILED: 'CREATING_VOLUME_FAILED',

  CREATING_NETWORK: 'CREATING_NETWORK',
  CREATING_NETWORK_SUCCESS: 'CREATING_NETWORK_SUCCESS',
  CREATING_NETWORK_FAILED: 'CREATING_NETWORK_FAILED',

  GET_CONTAINER: 'GET_CONTAINER',
  GET_CONTAINER_FAILED: 'GET_CONTAINER_FAILED',
  GET_CONTAINER_PASSED: 'GET_CONTAINER_PASSED',

  CONTAINER_STARTING: 'CONTAINER_STARTING',
  CONTAINER_FAILED: 'CONTAINER_FAILED',
  CONTAINER_STARTED: 'CONTAINER_STARTED',

  EXPOSED_URL_STARTED: 'EXPOSED_URL_STARTED',

  RUN_CONTAINER_OPERATION: 'RUN_CONTAINER_OPERATION',
  FINISH_CONTAINER_OPERATION: 'FINISH_CONTAINER_OPERATION',
  CONTAINER_OPERATION_FAILED: 'CONTAINER_OPERATION_FAILED',

  RETREIVING_JOB_DEFINATION: 'RETREIVING_JOB_DEFINATION',
  RETREIVED_JOB_DEFINATION: 'RETREIVED_JOB_DEFINATION',
  RETREIVING_JOB_DEFINATION_FAILED: 'RETREIVING_JOB_DEFINATION_FAILED',

  JOB_DEFINATION_VALIDATION: 'JOB_DEFINATION_VALIDATION',
  JOB_DEFINATION_VALIDATION_PASSED: 'JOB_DEFINATION_VALIDATION_PASSED',

  STARTING_NEW_FLOW: 'STARTING_NEW_FLOW',
  STARTED_NEW_FLOW: 'STARTED_NEW_FLOW',
  FLOW_FINISHED: 'FLOW_FINISHED',
  CONTINUE_EXISTING_FLOW: 'CONTINUE_EXISTING_FLOW',

  WAITING_FOR_JOB_TO_COMPLETE: 'WAITING_FOR_JOB_TO_COMPLETE',

  OPERATION_STARTING: 'OPERATION_STARTING',
  OPERATION_STARTED: 'OPERATION_STARTED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  OPERATION_PASSED: 'OPERATION_PASSED',

  NONE: 'NONE',
} as const;

export type JobState = (typeof JOB_STATE_NAME)[keyof typeof JOB_STATE_NAME];

export type PullingImageData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  image: string;
};

export type PullingImageFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  image: string;
  error: string;
};

export type PullingImageSuccessData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  image: string;
};

export type CreatingVolumeData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  volume: string;
};

export type CreatingVolumeSucessData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  volume: string;
};

export type CreatingVolumeFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  volume: string;
};

export type CreatingNetworkData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  network: string;
};

export type CreatingNetworkSucessData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  network: string;
};

export type CreatingNetworkFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  network: string;
  error: Error;
};

export type GetContainerData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
};

export type GetContainerSucessData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
};

export type GetContainerFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
};

export type ContainerStartingData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
  image: string;
};

export type ContainerStartingSucessData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
  image: string;
};

export type ContainerStartingFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  container: string;
  image: string;
  error: Error;
};

export type ExposedUrlStartedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
  operation: string;
  isUrlPrivate: boolean;
  url: string;
};

export type RunContainerOperationData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
};

export type FinishContainerOperationData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
};

export type ContainerOperationFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  error: Error;
};

export type OperationStartingData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type OperationStartedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
};

export type OperationFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
  error: Error;
};

export type OperationPassedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  operation: string;
  flow: string;
};

export type RetrievingJobDefinationData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
};

export type RetrievedJobDefinationData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
};

export type RetrievingJobDefinationFailedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  error: Error;
};

export type StartingNewFlowData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type StartedNewFlowData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type ContinueExistingFlowData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type FlowFinishedData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type WaitingForJobToCompleteData = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
  flow: string;
};

export type NoneData = {};

export type JobStateData = {
  [JOB_STATE_NAME.PULLING_IMAGE]: PullingImageData;
  [JOB_STATE_NAME.PULLING_IMAGE_FAILED]: PullingImageFailedData;
  [JOB_STATE_NAME.PULLING_IMAGE_SUCCESS]: PullingImageSuccessData;

  [JOB_STATE_NAME.CREATING_VOLUME]: CreatingVolumeData;
  [JOB_STATE_NAME.CREATING_VOLUME_FAILED]: CreatingVolumeFailedData;
  [JOB_STATE_NAME.CREATING_VOLUME_SUCCESS]: CreatingVolumeSucessData;

  [JOB_STATE_NAME.CREATING_NETWORK]: CreatingNetworkData;
  [JOB_STATE_NAME.CREATING_NETWORK_FAILED]: CreatingNetworkFailedData;
  [JOB_STATE_NAME.CREATING_NETWORK_SUCCESS]: CreatingNetworkSucessData;

  [JOB_STATE_NAME.GET_CONTAINER]: GetContainerData;
  [JOB_STATE_NAME.GET_CONTAINER_FAILED]: GetContainerFailedData;
  [JOB_STATE_NAME.GET_CONTAINER_PASSED]: GetContainerSucessData;

  [JOB_STATE_NAME.CONTAINER_STARTING]: ContainerStartingData;
  [JOB_STATE_NAME.CONTAINER_FAILED]: ContainerStartingFailedData;
  [JOB_STATE_NAME.CONTAINER_STARTED]: ContainerStartingSucessData;

  [JOB_STATE_NAME.EXPOSED_URL_STARTED]: ExposedUrlStartedData;

  [JOB_STATE_NAME.RUN_CONTAINER_OPERATION]: RunContainerOperationData;
  [JOB_STATE_NAME.FINISH_CONTAINER_OPERATION]: FinishContainerOperationData;
  [JOB_STATE_NAME.CONTAINER_OPERATION_FAILED]: ContainerOperationFailedData;

  [JOB_STATE_NAME.OPERATION_STARTING]: OperationStartingData;
  [JOB_STATE_NAME.OPERATION_STARTED]: OperationStartedData;
  [JOB_STATE_NAME.OPERATION_FAILED]: OperationFailedData;
  [JOB_STATE_NAME.OPERATION_PASSED]: OperationPassedData;

  [JOB_STATE_NAME.RETREIVING_JOB_DEFINATION]: RetrievingJobDefinationData;
  [JOB_STATE_NAME.RETREIVED_JOB_DEFINATION]: RetrievedJobDefinationData;
  [JOB_STATE_NAME.RETREIVING_JOB_DEFINATION_FAILED]: RetrievingJobDefinationFailedData;

  [JOB_STATE_NAME.JOB_DEFINATION_VALIDATION]: NoneData;
  [JOB_STATE_NAME.JOB_DEFINATION_VALIDATION_PASSED]: NoneData;

  [JOB_STATE_NAME.STARTING_NEW_FLOW]: StartingNewFlowData;
  [JOB_STATE_NAME.STARTED_NEW_FLOW]: StartedNewFlowData;
  [JOB_STATE_NAME.CONTINUE_EXISTING_FLOW]: ContinueExistingFlowData;
  [JOB_STATE_NAME.FLOW_FINISHED]: FlowFinishedData;

  [JOB_STATE_NAME.WAITING_FOR_JOB_TO_COMPLETE]: WaitingForJobToCompleteData;

  [JOB_STATE_NAME.NONE]: NoneData;
};
