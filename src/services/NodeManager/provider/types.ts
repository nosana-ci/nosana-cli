import typia from 'typia';
import {
  JobDefinition as JobDefinitionSDK,
  type OperationArgsMap,
} from '@nosana/sdk';

import { type Resource } from '@nosana/sdk/dist/types/resources';
import { Execution, TaskManagerOps } from '../node/task/TaskManager';

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

export type JobDefinition = {
    version: string;
    type: JobType;
    logistics?: JobLogistics;
    meta?: {
        trigger?: string;
        system_resources?: {
            [key: string]: string | number;
        };
        [key: string]: unknown;
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
    ops: TaskManagerOps;
}

// export type JobDefinition = JobDefinitionSDK & {
//   logistics?: JobLogistics;
//   meta?: JobDefinitionSDK['meta'] & {
//     [key: string]: unknown;
//   };
// };
export type JobType = 'container';

export type Operation<T extends OperationType> = {
  type: OperationType;
  id: string;
  args: OperationArgsMap[T];
  results?: OperationResults;
  execution?: Execution;
};
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

export type ReturnedStatus<T = undefined> =
  | { status: true; result?: T; error?: never } // If status is true, result is optional
  | { status: false; error: Error | unknown; result?: never }; // If status is false, error is required and result is not allowed
