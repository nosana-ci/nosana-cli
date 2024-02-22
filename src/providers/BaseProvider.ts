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
export type RunState = {
  id: string;
  status: string;
  ops: Array<OpState>;
}

export type OpState = {
  id: string;
  providerRunId: string;
  status: string;
  startTime: number;
  endTime: number;
  exitCode: number;
  logs: Array<{
    type: 'stdin' | 'stdout' | 'stderr';
    log: string | undefined;
  }>;
};

export abstract class BaseProvider {
  abstract run(JobDefinition: JobDefinition): string;
  abstract healthy(): Promise<Boolean>;
  abstract getRunState?(id: string): RunState | undefined;
}
