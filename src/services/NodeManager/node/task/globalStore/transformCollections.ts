import { Operation, OperationArgsMap, OperationType } from '@nosana/sdk';
import TaskManager from '../TaskManager.js';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

interface MarkerSpec {
  key: string;
  arrayHandler?: (raw: JSONValue) => JSONValue[];
  objectHandler?: (raw: JSONValue) => Record<string, JSONValue>;
}

const SpreadMarker: MarkerSpec = {
  key: '__spread__',

  objectHandler: (raw: JSONValue): Record<string, JSONValue> => {
    const parse = (label: string, v: JSONValue): Record<string, JSONValue> => {
      const obj =
        typeof v === 'string'
          ? (() => {
              try {
                return JSON.parse(v) as JSONValue;
              } catch (e) {
                throw new Error(
                  `${label} is not valid JSON: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                );
              }
            })()
          : v;

      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error(`${label} must be a JSON object`);
      }
      return obj as Record<string, JSONValue>;
    };

    return parse('__spread__', raw);
  },

  arrayHandler: (raw: JSONValue): JSONValue[] => {
    const parse = (label: string, v: JSONValue): JSONValue[] => {
      const arr =
        typeof v === 'string'
          ? (() => {
              try {
                return JSON.parse(v) as JSONValue;
              } catch (e) {
                throw new Error(
                  `${label} is not valid JSON: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                );
              }
            })()
          : v;

      if (!Array.isArray(arr)) {
        throw new Error(`${label} must be a JSON array`);
      }
      return arr as JSONValue[];
    };

    return parse('__spread__', raw);
  },
};

const PairsMarker: MarkerSpec = {
  key: '__pairs__',
  objectHandler: (raw: JSONValue): Record<string, JSONValue> => {
    const parseArray = (label: string, v: JSONValue): JSONValue[] => {
      const parsed =
        typeof v === 'string'
          ? (() => {
              try {
                return JSON.parse(v) as JSONValue;
              } catch (e) {
                throw new Error(
                  `${label} is not valid JSON: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                );
              }
            })()
          : v;

      if (!Array.isArray(parsed)) {
        throw new Error(`${label} must be a JSON array`);
      }
      return parsed as JSONValue[];
    };

    const arr = parseArray('__pairs__', raw);
    const out: Record<string, JSONValue> = {};

    for (const it of arr) {
      if (!it || typeof it !== 'object' || Array.isArray(it)) {
        throw new Error(`__pairs__ items must be objects`);
      }

      const rec = it as Record<string, JSONValue>;
      const key = rec.key;
      const value = rec.value;

      if (typeof key !== 'string') {
        throw new Error(`__pairs__ item.key must be string`);
      }

      out[key] = value ?? '';
    }

    return out;
  },

  arrayHandler: (raw: JSONValue): JSONValue[] => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed))
      throw new Error(`__pairs__ must be a JSON array`);
    return parsed as JSONValue[];
  },
};

export const DefaultCollectionMarkers: MarkerSpec[] = [
  SpreadMarker,
  PairsMarker,
];

export function transformCollections<T extends OperationType>(
  this: TaskManager,
  op: Operation<T>,
  overwrite: boolean = true,
): Operation<T> {
  const markers = DefaultCollectionMarkers;

  const isMarkerKey = (k: string) => markers.some((m) => m.key === k);
  const getMarker = (k: string) => markers.find((m) => m.key === k)!;

  const visit = (node: JSONValue): JSONValue => {
    if (Array.isArray(node)) {
      const out: JSONValue[] = [];
      for (const el0 of node) {
        if (el0 && typeof el0 === 'object' && !Array.isArray(el0)) {
          const entries = Object.entries(el0 as Record<string, JSONValue>);
          if (entries.length === 1) {
            const [mk, raw] = entries[0];
            const spec = getMarker(mk);
            if (spec?.arrayHandler) {
              const items = spec.arrayHandler(raw).map(visit);
              out.push(...items);
              continue;
            }
          }
        }
        out.push(visit(el0 as JSONValue));
      }
      return out;
    }

    if (node && typeof node === 'object') {
      const obj = node as Record<string, JSONValue>;

      const base: Record<string, JSONValue> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!isMarkerKey(k)) base[k] = visit(v as JSONValue);
      }

      for (const [k, raw] of Object.entries(obj)) {
        if (!isMarkerKey(k)) continue;
        const spec = getMarker(k);
        if (!spec?.objectHandler) continue;

        const patch = spec.objectHandler(raw);
        for (const [pk, pv] of Object.entries(patch)) {
          if (overwrite || !(pk in base)) base[pk] = pv;
        }
      }

      return base;
    }

    return node;
  };

  const nextArgs = visit(
    op.args as unknown as JSONValue,
  ) as OperationArgsMap[T];

  return { ...op, args: nextArgs };
}
