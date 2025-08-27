import TaskManager from '../TaskManager.js';

export function getOperationsStatus(this: TaskManager): Record<string, string> {
  return Object.fromEntries(this.operationStatus);
}

export function getOperationStatus(
  this: TaskManager,
  id: string,
): Record<string, string | null> {
  const status = this.operationStatus.get(id);
  return {
    [id]: status ?? null,
  };
}

export function getCurrentGroup(this: TaskManager): string | undefined {
  return this.currentGroup;
}

export function getCurrentGroupStatus(
  this: TaskManager,
): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  const group = this.currentGroup;
  const context = this.executionPlan.find((ctx) => ctx.group === group);
  if (!context) return record;

  for (const opId of context.ops) {
    record[opId] = this.operationStatus.get(opId) ?? null;
  }

  return record;
}

export function getGroupStatus(
  this: TaskManager,
  group: string,
): Record<string, string | null> {
  const record: Record<string, string | null> = {};

  const context = this.executionPlan.find((ctx) => ctx.group === group);
  if (!context) return record;

  for (const opId of context.ops) {
    record[opId] = this.operationStatus.get(opId) ?? null;
  }

  return record;
}
