import TaskManager, { TaskManagerOps } from '../TaskManager.js';

export function setResult(
  this: TaskManager,
  opId: string,
  key: string,
  value: any,
): void {
  const op = (this.globalOpStore[opId] ??= {});
  const results = (op.results ??= {});
  results[key] = value;
}
