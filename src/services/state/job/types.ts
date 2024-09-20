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

export type BasicNodeInfo = {
  node: string;
  ipfs: string;
  job: string;
  market: string;
};

export type OperationData = BasicNodeInfo & {
  operation: string;
  flow: string;
};

export type PullingImageData = OperationData & {
  image: string;
};

export type PullingImageFailedData = PullingImageData & {
  error: string;
};

export type PullingImageSuccessData = PullingImageData;

export type CreatingVolumeData = OperationData & {
  volume: string;
};

export type CreatingVolumeSuccessData = CreatingVolumeData;

export type CreatingVolumeFailedData = CreatingVolumeData & {
  error: string;
};

export type CreatingNetworkData = OperationData & {
  network: string;
};

export type CreatingNetworkSuccessData = CreatingNetworkData;

export type CreatingNetworkFailedData = CreatingNetworkData & {
  error: Error;
};

export type GetContainerData = OperationData & {
  container: string;
};

export type GetContainerSuccessData = GetContainerData;

export type GetContainerFailedData = GetContainerData & {
  error: Error;
};

export type ContainerStartingData = GetContainerData & {
  image: string;
};

export type ContainerStartingSuccessData = ContainerStartingData;

export type ContainerStartingFailedData = ContainerStartingData & {
  error: Error;
};

export type ExposedUrlStartedData = OperationData & {
  isUrlPrivate: boolean;
  url: string;
};

export type RunContainerOperationData = OperationData;

export type FinishContainerOperationData = OperationData;

export type ContainerOperationFailedData = OperationData & {
  error: Error;
};

export type RetrievingJobDefinitionData = BasicNodeInfo;

export type RetrievedJobDefinitionData = BasicNodeInfo;

export type RetrievingJobDefinitionFailedData = BasicNodeInfo & {
  error: Error;
};

export type StartingNewFlowData = OperationData;

export type StartedNewFlowData = OperationData;

export type ContinueExistingFlowData = OperationData;

export type FlowFinishedData = OperationData;

export type OperationStartingData = BasicNodeInfo & {
  flow: string;
};

export type OperationStartedData = OperationData;

export type OperationFailedData = OperationData & {
  error: Error;
};

export type OperationPassedData = OperationData;

export type WaitingForJobToCompleteData = OperationData;

export type NoneData = {};

export type JobStateData = {
  [JOB_STATE_NAME.PULLING_IMAGE]: PullingImageData;
  [JOB_STATE_NAME.PULLING_IMAGE_FAILED]: PullingImageFailedData;
  [JOB_STATE_NAME.PULLING_IMAGE_SUCCESS]: PullingImageSuccessData;

  [JOB_STATE_NAME.CREATING_VOLUME]: CreatingVolumeData;
  [JOB_STATE_NAME.CREATING_VOLUME_FAILED]: CreatingVolumeFailedData;
  [JOB_STATE_NAME.CREATING_VOLUME_SUCCESS]: CreatingVolumeSuccessData;

  [JOB_STATE_NAME.CREATING_NETWORK]: CreatingNetworkData;
  [JOB_STATE_NAME.CREATING_NETWORK_FAILED]: CreatingNetworkFailedData;
  [JOB_STATE_NAME.CREATING_NETWORK_SUCCESS]: CreatingNetworkSuccessData;

  [JOB_STATE_NAME.GET_CONTAINER]: GetContainerData;
  [JOB_STATE_NAME.GET_CONTAINER_FAILED]: GetContainerFailedData;
  [JOB_STATE_NAME.GET_CONTAINER_PASSED]: GetContainerSuccessData;

  [JOB_STATE_NAME.CONTAINER_STARTING]: ContainerStartingData;
  [JOB_STATE_NAME.CONTAINER_FAILED]: ContainerStartingFailedData;
  [JOB_STATE_NAME.CONTAINER_STARTED]: ContainerStartingSuccessData;

  [JOB_STATE_NAME.EXPOSED_URL_STARTED]: ExposedUrlStartedData;

  [JOB_STATE_NAME.RUN_CONTAINER_OPERATION]: RunContainerOperationData;
  [JOB_STATE_NAME.FINISH_CONTAINER_OPERATION]: FinishContainerOperationData;
  [JOB_STATE_NAME.CONTAINER_OPERATION_FAILED]: ContainerOperationFailedData;

  [JOB_STATE_NAME.OPERATION_STARTING]: OperationStartingData;
  [JOB_STATE_NAME.OPERATION_STARTED]: OperationStartedData;
  [JOB_STATE_NAME.OPERATION_FAILED]: OperationFailedData;
  [JOB_STATE_NAME.OPERATION_PASSED]: OperationPassedData;

  [JOB_STATE_NAME.RETREIVING_JOB_DEFINATION]: RetrievingJobDefinitionData;
  [JOB_STATE_NAME.RETREIVED_JOB_DEFINATION]: RetrievedJobDefinitionData;
  [JOB_STATE_NAME.RETREIVING_JOB_DEFINATION_FAILED]: RetrievingJobDefinitionFailedData;

  [JOB_STATE_NAME.JOB_DEFINATION_VALIDATION]: NoneData;
  [JOB_STATE_NAME.JOB_DEFINATION_VALIDATION_PASSED]: NoneData;

  [JOB_STATE_NAME.STARTING_NEW_FLOW]: StartingNewFlowData;
  [JOB_STATE_NAME.STARTED_NEW_FLOW]: StartedNewFlowData;
  [JOB_STATE_NAME.CONTINUE_EXISTING_FLOW]: ContinueExistingFlowData;
  [JOB_STATE_NAME.FLOW_FINISHED]: FlowFinishedData;

  [JOB_STATE_NAME.WAITING_FOR_JOB_TO_COMPLETE]: WaitingForJobToCompleteData;

  [JOB_STATE_NAME.NONE]: NoneData;
};
