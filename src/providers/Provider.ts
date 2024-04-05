// TODO: move types to SDK
import { CronJob } from 'cron';
import typia from 'typia';

/************************
 * Job Definition Types *
 ************************/
export type JobDefinition = {
  version: string;
  type: JobType;
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
  ops: Array<Operation<OperationType>>;
};
export type JobType = 'container';

export type Operation<T extends OperationType> = {
  type: OperationType;
  id: string;
  args: OperationArgsMap[T];
};
export interface OperationArgsMap {
  'container/run': {
    image: string;
    cmd: string[] | string;
    volumes?: [
      {
        name: string;
        dest: string;
      },
    ];
    gpu?: boolean;
    work_dir?: string;
    entrypoint?: string | string[];
    env?: {
      [key: string]: string;
    };
  };
  'container/create-volume': {
    name: string;
  };
}
export type OperationType = keyof OperationArgsMap;

/************************
 *   Job Result Types   *
 ************************/
export type FlowState = {
  status: string;
  startTime: number;
  endTime: number | null;
  errors?: Array<any>;
  opStates: Array<OpState>;
};
export type Flow = {
  id: string;
  jobDefinition: JobDefinition;
  state: FlowState;
};

export type OpState = {
  providerId: string | null;
  operationId: string | null;
  status: string | null;
  startTime: number | null;
  endTime: number | null;
  exitCode: number | null;
  logs: Array<{
    type: 'stdin' | 'stdout' | 'stderr' | 'nodeerr';
    log: string | undefined;
  }>;
};

export const validateJobDefinition =
  typia.createValidateEquals<JobDefinition>();

export abstract class Provider {
  abstract run(JobDefinition: JobDefinition, flowStateId?: string): Flow;
  abstract healthy(): Promise<Boolean>;
  abstract getFlow(id: string): Flow | undefined;
  abstract continueFlow(flowId: string): Flow | Promise<Flow>;
  abstract clearFlow(flowId: string): Promise<void>;
  abstract stopFlow(flowId: string): Promise<void>;
  abstract finishFlow(flowId: string, status?: string): void;
  abstract waitForFlowFinish(
    id: string,
    logCallback?: Function,
  ): Promise<FlowState | null>;
  abstract clearOldFlows(): Promise<void>;
  public clearFlowsCronJob?: CronJob;
}
