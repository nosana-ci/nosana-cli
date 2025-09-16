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

  // Now that results changed for opId, rehydrate any non-dynamic endpoints for this op
  const flow = this.repository.getflow(this.job);
  if (flow) {
    this.rehydrateEndpointsForOperation(
      flow.id,
      flow.project,
      flow.jobDefinition,
      opId,
    );
  }
}
