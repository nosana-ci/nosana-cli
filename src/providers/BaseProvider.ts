// TODO: move types to SDK

/************************
 * Job Definition Types *
 ************************/
export type JobDefinition = {
  version: string;
  type: JobType;
  trigger?: string;
  ops: Array<Operation<OperationType>>;
};
export type JobType = 'docker';

export type Operation<T extends OperationType> = {
  type: OperationType;
  id: string;
  args: OperationArgsMap[T];
};
export type OperationArgsMap = {
  'container/run': {
    image: string;
    cmds: Array<string>;
  };
  'container/create-volume': {
    name: string;
  };
};
export type OperationType = keyof OperationArgsMap;

/************************
 *   Job Result Types   *
 ************************/
export type Result = {
  status: string;
  ops: Array<OperationResult>;
};
export type OperationResult = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
  exitCode: number;
  logs: Array<{
    type: 'stdin' | 'stdout' | 'stderr';
    log: string | undefined;
  }>;
};

export abstract class BaseProvider {
  abstract run(JobDefinition: JobDefinition): Promise<Result>;
  abstract healthy(): Promise<Boolean>;
}
