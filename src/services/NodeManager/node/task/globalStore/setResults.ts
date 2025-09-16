import TaskManager from '../TaskManager.js';

export function setResults(
  this: TaskManager,
  opId: string,
  values: Record<string, any>,
): void {
  const op = (this.globalOpStore[opId] ??= {});
  op.results = { ...(op.results ?? {}), ...values };

  // Results updated for opId; attempt endpoint rehydration for this op
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
