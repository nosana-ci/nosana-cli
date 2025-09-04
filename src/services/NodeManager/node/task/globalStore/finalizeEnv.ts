import { Operation, OperationArgsMap, OperationType } from '@nosana/sdk';

export function finalizeEnvOnOperation<T extends OperationType>(
  op: Operation<T>,
): Operation<T> {
  const argsAny = op.args as unknown as Record<string, unknown>;
  const env = argsAny?.env;

  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    return op;
  }

  const toEnvString = (v: unknown): string => {
    if (v == null) return '';
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
      return String(v);
    }
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const newEnv = Object.fromEntries(
    Object.entries(env as Record<string, unknown>).map(([k, v]) => [k, toEnvString(v)]),
  );

  const nextArgs: OperationArgsMap[T] = {
    ...(op.args as any),
    env: newEnv,
  };

  return { ...op, args: nextArgs };
}
