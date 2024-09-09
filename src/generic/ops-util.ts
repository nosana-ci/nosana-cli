import { Operation, OperationType, OperationArgsMap, JobDefinition } from "../providers/Provider";

export const isPrivate = (job: JobDefinition): boolean => {
    return job.ops.some(
      (op: Operation<OperationType>) =>
        op.type === 'container/run' &&
        (op.args as OperationArgsMap['container/run']).expose !== undefined &&
        (op.args as OperationArgsMap['container/run']).private === true 
    );
  };
  
  export const isExposed = (job: JobDefinition): boolean => {
    return job.ops.some(
      (op: Operation<OperationType>) =>
        op.type === 'container/run' &&
        (op.args as OperationArgsMap['container/run']).expose !== undefined
    );
  };