import TaskManager from '../TaskManager.js';

export function interpolate<T = any>(this: TaskManager, value: T): T {
  if (typeof value === 'string') {
    return this.resolveLiteralsInString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => this.interpolate(v)) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      out[k] = this.interpolate(v);
    }
    return out;
  }

  return value;
}
