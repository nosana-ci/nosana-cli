import TaskManager from '../TaskManager.js';

export function setHost(this: TaskManager, opId: string, host: string): void {
  const op = (this.globalOpStore[opId] ??= {});
  op.host = host;
}
