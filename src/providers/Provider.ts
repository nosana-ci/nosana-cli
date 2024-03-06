// TODO: move types to SDK
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
    cmds: string[];
  };
  'container/create-volume': {
    name: string;
  };
}
export type OperationType = keyof OperationArgsMap;

/************************
 *   Job Result Types   *
 ************************/
export type Flow = {
  id: string;
  status: string;
  error?: string;
  startTime: number;
  endTime: number | null;
  jobDefinition: JobDefinition;
  errors?: Array<any>; // todo: error type based on status?
  state: Array<OpState>;
};

export type OpState = {
  id: string | null;
  status: string | null;
  startTime: number | null;
  endTime: number | null;
  exitCode: number | null;
  operation: Operation<OperationType>;
  logs: Array<{
    type: 'stdin' | 'stdout' | 'stderr';
    log: string | undefined;
  }>;
};

export const validateJobDefinition =
  typia.createValidateEquals<JobDefinition>();

export abstract class Provider {
  abstract run(JobDefinition: JobDefinition, flowStateId?: string): Flow;
  abstract healthy(): Promise<Boolean>;
  abstract getFlow(id: string): Flow | undefined;
  abstract continueFlow(flowId: string): Flow;
  abstract clearFlow(flowId: string): Promise<void>;
  abstract waitForFlowFinish(id: string, logCallback?: Function): Promise<Flow>;
}
