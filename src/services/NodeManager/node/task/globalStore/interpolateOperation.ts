import { Operation, OperationArgsMap, OperationType } from '@nosana/sdk';
import TaskManager, { GlobalStore } from '../TaskManager.js';

export function interpolateOperation<T extends OperationType>(
  this: TaskManager,
  op: Operation<T>,
): Operation<T> {
  // %%ops.<opId>.<path>%% — path supports host or nested results like results.url
  const LITERAL_RE = /%%ops\.([^.]+)\.([A-Za-z0-9._-]+)%%/g;
  const GLOBAL_RE = /%%globals\.([^.]+)%%/g;

  const getByPathStrict = (opId: string, path: string): unknown => {
    const bucket = this.globalOpStore?.[opId];
    if (!bucket) return undefined;
    if (path === 'host') return bucket.host;

    let cur: any = bucket;
    for (const seg of path.split('.')) {
      cur = cur?.[seg];
      if (cur == null) return undefined; // treat null/undefined as unresolved
    }
    return cur;
  };

  const resolveStringStrict = (input: string): string => {
    let result = input.replace(GLOBAL_RE, (match, key: keyof GlobalStore) => {
      const value = this.globalStore[key];
      if (!value) {
        throw new Error(`Unresolved literal: "${match}" (key="${key}")`);
      }
      return value;
    });
    return result.replace(LITERAL_RE, (match, opId: string, path: string) => {
      const value = getByPathStrict(opId, path);
      if (value == null) {
        throw new Error(
          `Unresolved literal: "${match}" (opId="${opId}", path="${path}")`,
        );
      }
      return String(value);
    });
  };

  // Recursively interpolate strings/arrays/objects, throwing on unresolved
  const interpolateAnyStrict = (val: unknown): unknown => {
    if (typeof val === 'string') return resolveStringStrict(val);
    if (Array.isArray(val)) return val.map(interpolateAnyStrict);
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = interpolateAnyStrict(v);
      }
      return out;
    }
    return val; // number | boolean | null | undefined
  };

  const interpolatedArgs = interpolateAnyStrict(op.args) as OperationArgsMap[T];

  const env = (interpolatedArgs as any)?.env;
  const argsWithEnv =
    env && typeof env === 'object'
      ? {
          ...(interpolatedArgs as any),
          env: Object.fromEntries(
            Object.entries(env).map(([k, v]) => [
              k,
              v == null ? '' : String(v),
            ]),
          ),
        }
      : interpolatedArgs;

  const containsLiteral = (v: unknown): boolean => {
    if (typeof v === 'string') return /%%ops\.[^.]+\.[A-Za-z0-9._-]+%%/.test(v);
    if (Array.isArray(v)) return v.some(containsLiteral);
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) {
        if (containsLiteral(val)) return true;
      }
    }
    return false;
  };
  if (containsLiteral(argsWithEnv)) {
    throw new Error('Unresolved literals remain in interpolated args');
  }

  return { ...op, args: argsWithEnv };
}
