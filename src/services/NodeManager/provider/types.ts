import typia from 'typia';
import {
  JobDefinition as JobDefinitionSDK,
  Operation,
  OperationType,
  type OperationArgsMap,
} from '@nosana/sdk';

import { type Resource } from '@nosana/sdk/dist/types/resources';

export const validateJobDefinition =
  typia.createValidateEquals<JobDefinition>();

export type RequiredResource = Omit<Resource, 'target'>;

export type Ops = Array<Operation<OperationType>>;

export interface JobLogistics {
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

export type JobDefinition = JobDefinitionSDK & {
  logistics?: JobLogistics;
  meta?: JobDefinitionSDK['meta'] & {
    [key: string]: unknown;
  };
};
export type JobType = 'container';

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
  secrets?: FlowSecrets;
};
export type Flow = {
  id: string;
  jobDefinition: JobDefinition;
  project: string;
  state: FlowState;
};

export type Log = {
  type: StdOptions;
  log: string | undefined;
};

export type EndpointStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export type EndpointSecret = {
  opID: string;
  port: number | string;
  url: string;
  status: EndpointStatus;
};

export interface JobExposeSecrets {
  [exposeId: string]: EndpointSecret;
}

export type FlowSecrets = {
  urlmode?: 'private' | 'public';
  [jobId: string]: JobExposeSecrets | 'private' | 'public' | undefined;
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

export type ReturnedStatus<T = undefined> =
  | { status: true; result?: T; error?: never } // If status is true, result is optional
  | { status: false; error: Error | unknown; result?: never }; // If status is false, error is required and result is not allowed
