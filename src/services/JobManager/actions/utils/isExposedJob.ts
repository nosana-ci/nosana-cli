import {
  JobDefinition,
  OperationArgsMap,
} from '../../../../providers/Provider.js';

export function isExposedJobOps(job: JobDefinition): boolean {
  return job.ops.some(
    (op) =>
      op.type === 'container/run' &&
      (op.args as OperationArgsMap['container/run']).expose,
  );
}
