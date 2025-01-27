import {
  JobDefinition,
  OperationArgsMap,
} from '../../../NodeManager/provider/types.js';

export function isExposedJobOps(job: JobDefinition): boolean {
  return job.ops.some(
    (op) =>
      op.type === 'container/run' &&
      (op.args as OperationArgsMap['container/run']).expose,
  );
}
