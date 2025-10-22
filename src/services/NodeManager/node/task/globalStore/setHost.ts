import TaskManager from '../TaskManager.js';

export function setHost(this: TaskManager, opId: string, flowId: string): void {
  const op = (this.globalOpStore[opId] ??= {});
  op.host = flowId + '-' + this.getOpStateIndex(opId);

  // Host updated; attempt endpoint rehydration for this op
  const flow = this.repository.getFlow(this.job);
  if (flow) {
    this.rehydrateEndpointsForOperation(
      flow.id,
      flow.project,
      flow.jobDefinition,
      opId,
    );
  }
}
