
export type OperationType = "container/run" | "container/create-volume";
export type JobType = "docker";
export type Operation = {
  op: OperationType;
  id: string;
  args?: { [key: string]: any };
}
export type OperationResult = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
  exitCode: number;
  logs: Array<{
    type: "stdin" | "stdout" | "stderr";
    log: string;
  }>
}

export type JobDefinition = {
  version: string;
  type: JobType;
  trigger?: string;
  ops: Array<Operation>;
}

export type Result = {
  status: string;
  ops: Array<OperationResult>;
}

export abstract class Provider {
  abstract run(jobDefinition: JobDefinition): Promise<Result>;
}
