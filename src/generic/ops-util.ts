import { Operation, OperationArgsMap, OperationType } from '@nosana/sdk';

import { JobDefinition } from '../services/NodeManager/provider/types.js';

export const isPrivate = (job: JobDefinition): boolean => {
  return job.ops.some((op: Operation<OperationType>) => {
    if (op.type !== 'container/run') return false;

    const args = op.args as OperationArgsMap['container/run'];
    const expose = args.expose;

    const isExposed =
      (Array.isArray(expose) && expose.length > 0) ||
      typeof expose === 'number';

    return isExposed && args.private === true;
  });
};

export const isExposed = (job: JobDefinition): boolean => {
  return job.ops.some((op: Operation<OperationType>) => {
    if (op.type !== 'container/run') return false;

    const expose = (op.args as OperationArgsMap['container/run']).expose;

    return (
      (Array.isArray(expose) && expose.length > 0) || typeof expose === 'number'
    );
  });
};
