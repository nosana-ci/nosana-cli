import typia from 'typia';

export const validateJobDefinition =
  typia.createValidateEquals<JobDefinition>();

export type S3Unsecure = {
  type: 'S3';
  url?: string;
  target: string;
  files?: string[];
  allowWrite?: boolean;
  buckets?: { url: string; files?: string[] }[];
};

export type S3Auth = {
  REGION: string;
  ACCESS_KEY_ID: string;
  SECRET_ACCESS_KEY: string;
};

export type S3Secure = S3Unsecure & {
  IAM: S3Auth;
};

export type Resource = S3Unsecure | S3Secure;

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
    expose?: number | number[];
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

export type ReturnedStatus<T = undefined> =
  | { status: true; result?: T; error?: never } // If status is true, result is optional
  | { status: false; error: Error | unknown; result?: never }; // If status is false, error is required and result is not allowed
