import type { Operation, OperationType } from '@nosana/sdk';

export function stanatizeArrays<T extends OperationType>(
  op: Operation<T>,
): Operation<T> {
  for (const [key, value] of Object.entries(op.args)) {
    if (Array.isArray(value)) {
      const indexOfEmptyOpArg = value.findIndex(
        (v) => v === '__remove-if-empty__',
      );
      if (indexOfEmptyOpArg !== -1) {
        value.splice(indexOfEmptyOpArg, 1);
        if (value.length === 0) {
          delete op.args[key as keyof typeof op.args];
        }
      }
    }
  }

  return op;
}
