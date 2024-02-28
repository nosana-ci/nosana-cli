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
export type FlowState = {
  id: string;
  status: string;
  startTime: number;
  endTime: number | null;
  ops: Array<OpState>;
}

export type OpState = {
  id: string;
  providerFlowId: string;
  status: string;
  startTime: number;
  endTime: number;
  exitCode: number;
  execs: Array<{
    id: string;
    cmd: Array<string>;
  }>;
  logs: Array<{
    type: 'stdin' | 'stdout' | 'stderr';
    log: string | undefined;
  }>;
};

export abstract class BaseProvider {
  abstract run(JobDefinition: JobDefinition): string;
  abstract healthy(): Promise<Boolean>;
  abstract getFlowState(id: string): FlowState | undefined;
  abstract waitForFlowFinish(id: string): Promise<FlowState | undefined>;
}
