import TaskManager from '../TaskManager.js';

export function getByPath(this: TaskManager, opId: string, path: string): any {
  const op = this.globalOpStore[opId];
  if (!op) return undefined;

  if (path === 'host') return op.host;

  return path.split('.').reduce<any>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as any)[key];
  }, op as any);
}
