// TODO: move types to SDK
import { CronJob } from 'cron';
import typia from 'typia';

import { Resource } from '../types/resources.js';

/************************
 * Job Definition Types *
 ************************/
export type Ops = Array<Operation<OperationType>>;

export interface JobLogicstics {
  send?: SendJobDefinationLogicstics;
  receive?: ReceiveJobResultLogicstics;
}

/**
 * api-listen - we have an api listenening for the job poster to send the job description
 * api        - we recieve an api endpoint to query and it will return the job description
 */
export type SendJobDefinationLogicsticsTypes = 'api' | 'api-listen';

export interface SendJobDefinationLogicstics {
  type: SendJobDefinationLogicsticsTypes;
  args: {
    endpoint?: string;
  };
}

/**
 * api-listen - we have an api that listen for request from the job poster, so we can return the result to them
 * api        - we get an api to post the result to
 */
export type ReceiveJobResultLogicsticsTypes = 'api' | 'api-listen';

export interface ReceiveJobResultLogicstics {
  type: ReceiveJobResultLogicsticsTypes;
  args: {
    endpoint?: string;
  };
}

export type JobDefinition = {
  version: string;
  type: JobType;
  logicstics?: JobLogicstics;
  meta?: {
    trigger?: string;
  };
  global?: {
    image?: string;
    gpu?: boolean;
    entrypoint?: string | string[];
    env?: {
      [key: string]: string;
    };
    work_dir?: string;
  };
  ops: Ops;
};
export type JobType = 'container';

export type Operation<T extends OperationType> = {
  type: OperationType;
  id: string;
  args: OperationArgsMap[T];
  results?: OperationResults;
};
export interface OperationArgsMap {
  'container/run': {
    image: string;
    cmd?: string[] | string;
    volumes?: [
      {
        name: string;
        dest: string;
      },
    ];
    expose?: number;
    private?: boolean;
    gpu?: boolean;
    work_dir?: string;
    output?: string;
    entrypoint?: string | string[];
    env?: {
      [key: string]: string;
    };
    resources?: Resource[];
  };
  'container/create-volume': {
    name: string;
  };
}
export type OperationType = keyof OperationArgsMap;

export type StdOptions = 'stdin' | 'stdout' | 'stderr' | 'nodeerr';

export type OperationResults = {
  [key: string]: string | OperationResult;
};

export type OperationResult = {
  regex: string;
  logType: [StdOptions, StdOptions?, StdOptions?, StdOptions?];
};

/************************
 *   Job Result Types   *
 ************************/
export type FlowState = {
  status: string;
  startTime: number;
  endTime: number | null;
  errors?: Array<any>;
  opStates: Array<OpState>;
  secrets?: {
    [key: string]: string;
  };
};
export type Flow = {
  id: string;
  jobDefinition: JobDefinition;
  state: FlowState;
};

export type Log = {
  type: StdOptions;
  log: string | undefined;
};

export type OpState = {
  providerId: string | null;
  operationId: string | null;
  status: string | null;
  startTime: number | null;
  endTime: number | null;
  exitCode: number | null;
  logs: Array<Log>;
  results?: {
    [key: string]: string | string[];
  };
};

export const validateJobDefinition =
  typia.createValidateEquals<JobDefinition>();

export const ProviderEvents: { [key: string]: string } = {
  STOP_FLOW: 'stopFlowEvent',
  FLOW_FINISHED: 'flowFinished',
  INFO_LOG: 'infoLog',
  CONTAINER_LOG: 'containerLog',
};

export abstract class Provider {
  public abstract name: string;
  abstract run(JobDefinition: JobDefinition, flowStateId?: string): Flow;
  abstract healthy(): Promise<Boolean>;
  abstract getFlow(id: string): Flow | undefined;
  abstract continueFlow(flowId: string): Flow | Promise<Flow>;
  abstract clearFlow(flowId: string): Promise<void>;
  abstract stopFlow(flowId: string): Promise<void>;
  abstract stopFlowOperation(
    flowId: string,
    op: Operation<OperationType>,
  ): Promise<OpState>;
  abstract finishFlow(flowId: string, status?: string): void;
  abstract waitForFlowFinish(
    id: string,
    logCallback?: Function,
  ): Promise<FlowState | null>;
  abstract clearOldFlows(): Promise<void>;
  public clearFlowsCronJob?: CronJob;
  abstract updateMarketRequiredResources(market: string): Promise<void>;
}
