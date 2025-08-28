import TaskManager from '../TaskManager.js';

export function setResults(
  this: TaskManager,
  opId: string,
  values: Record<string, any>,
): void {
  const op = (this.globalOpStore[opId] ??= {});
  op.results = { ...(op.results ?? {}), ...values };
}
