import { Operation, OperationArgsMap, OperationType } from '@nosana/sdk';
import TaskManager, { GlobalStore } from '../TaskManager.js';

export function interpolateOperation<T extends OperationType>(
  this: TaskManager,
  op: Operation<T>,
): Operation<T> {
  // %%ops.<opId>.<path>%% and %%global.<key>%%
  const LITERAL_RE = /%%(ops|global)\.([^.]+)\.([A-Za-z0-9._-]+)%%/g;
  const LITERAL_RE_EXACT = /^%%(ops|global)\.([^.]+)\.([A-Za-z0-9._-]+)%%$/;
  const GLOBAL_RE = /%%(global|globals)\.([^.]+)%%/g;
  const GLOBAL_RE_EXACT = /^%%(global|globals)\.([^.]+)%%$/;

  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

  const parseJsonIfLooksLike = (v: unknown): unknown => {
    if (typeof v !== 'string') return v;
    const s = v.trim();
    if (!s) return v;
    const first = s[0];
    if (first !== '[' && first !== '{') return v;
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  };

  const valueToArrayTokens = (value: unknown): unknown[] => {
    const v = parseJsonIfLooksLike(value);

    if (Array.isArray(v)) {
      const out: unknown[] = [];
      for (const el of v) out.push(...valueToArrayTokens(el));
      return out;
    }
    if (isPlainObject(v)) {
      return [v];
    }
    if (v == null) return [];
    return [v]; // preserve primitive type
  };

  const valueToSpaceString = (value: unknown): string =>
    valueToArrayTokens(value)
      .map((x) => String(x))
      .join(' ');

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

  const getGlobalByPath = (key: string, path?: string): unknown => {
    const value = this.globalStore[key as keyof GlobalStore];
    if (!path) return value;

    let cur: any = value;
    for (const seg of path.split('.')) {
      cur = cur?.[seg];
      if (cur == null) return undefined;
    }
    return cur;
  };

  const resolveRawIfExact = (
    input: string,
  ): { matched: true; value: unknown } | { matched: false } => {
    // Check 3-part pattern first (%%global.key.path%% or %%ops.opId.path%%)
    let m = input.match(LITERAL_RE_EXACT);
    if (m) {
      const type = m[1]!; // "ops" or "global"
      const opId = m[2]!;
      const path = m[3]!;

      if (type === 'global') {
        // Handle %%global.key.subpath%% format
        let value = getGlobalByPath(opId, path);
        if (value == null || value === '') {
          throw new Error(
            `Unresolved literal: "${input}" (key="${opId}.${path}")`,
          );
        }
        // Parse JSON strings in arrays but don't convert to string
        if (Array.isArray(value)) {
          value = value.map((item) => parseJsonIfLooksLike(item));
        } else {
          value = parseJsonIfLooksLike(value);
        }
        return { matched: true, value };
      } else {
        // Handle %%ops.opId.path%% format
        let value = getByPathStrict(opId, path);
        if (value == null) {
          throw new Error(
            `Unresolved literal: "${input}" (opId="${opId}", path="${path}")`,
          );
        }
        // Parse JSON strings in arrays but don't convert to string
        if (Array.isArray(value)) {
          value = value.map((item) => parseJsonIfLooksLike(item));
        } else {
          value = parseJsonIfLooksLike(value);
        }
        return { matched: true, value };
      }
    }

    // Check 2-part pattern (%%global.key%%)
    m = input.match(GLOBAL_RE_EXACT);
    if (m) {
      const key = m[2] as keyof GlobalStore;
      const value = this.globalStore[key];
      if (value == null || value === '') {
        throw new Error(`Unresolved literal: "${input}" (key="${key}")`);
      }
      return { matched: true, value };
    }

    return { matched: false };
  };

  const resolveStringStrict = (input: string): string => {
    const exact = resolveRawIfExact(input);
    if (exact.matched) return valueToSpaceString(exact.value);

    // Handle 3-part patterns first
    let result = input.replace(
      LITERAL_RE,
      (match, type: string, opId: string, path: string) => {
        if (type === 'global') {
          const value = getGlobalByPath(opId, path);
          if (value == null || value === '') {
            throw new Error(
              `Unresolved literal: "${match}" (key="${opId}.${path}")`,
            );
          }
          return valueToSpaceString(value);
        } else {
          const value = getByPathStrict(opId, path);
          if (value == null) {
            throw new Error(
              `Unresolved literal: "${match}" (opId="${opId}", path="${path}")`,
            );
          }
          return valueToSpaceString(value);
        }
      },
    );

    // Handle 2-part patterns
    result = result.replace(
      GLOBAL_RE,
      (match, prefix, key: keyof GlobalStore) => {
        const value = this.globalStore[key];
        if (value == null || value === '') {
          throw new Error(`Unresolved literal: "${match}" (key="${key}")`);
        }
        return valueToSpaceString(value);
      },
    );

    return result;
  };

  const interpolateAnyStrict = (val: unknown): unknown => {
    if (typeof val === 'string') {
      const raw = resolveRawIfExact(val);
      if (raw.matched) return raw.value; // normalized later based on origin
      return resolveStringStrict(val);
    }
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

  const normalizeByOrigin = (value: unknown, original: unknown): unknown => {
    if (typeof original === 'string') {
      // If the resolved value is an array with a single item, return that item directly
      if (Array.isArray(value) && value.length === 1) {
        return value[0];
      }
      return valueToSpaceString(value);
    }
    if (Array.isArray(original)) {
      const out: unknown[] = [];
      const pushTokens = (v: unknown) => {
        out.push(...valueToArrayTokens(v));
      };

      if (Array.isArray(value)) {
        for (const el of value) pushTokens(el);
      } else {
        pushTokens(value);
      }
      return out;
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      const origObj =
        original && typeof original === 'object' && !Array.isArray(original)
          ? (original as Record<string, unknown>)
          : {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = normalizeByOrigin(v, origObj[k]);
      }
      return out;
    }
    return value;
  };

  const normalizedArgs = normalizeByOrigin(
    interpolatedArgs,
    op.args,
  ) as OperationArgsMap[T];

  const containsLiteral = (v: unknown): boolean => {
    if (typeof v === 'string') {
      return LITERAL_RE.test(v) || GLOBAL_RE.test(v);
    }
    if (Array.isArray(v)) return v.some(containsLiteral);
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) {
        if (containsLiteral(val)) return true;
      }
    }
    return false;
  };
  if (containsLiteral(normalizedArgs)) {
    throw new Error('Unresolved literals remain in interpolated args');
  }

  return { ...op, args: normalizedArgs };
}
