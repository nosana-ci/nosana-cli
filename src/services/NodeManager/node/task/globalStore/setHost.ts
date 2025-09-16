import TaskManager from '../TaskManager.js';

export function setHost(this: TaskManager, opId: string, host: string): void {
  const op = (this.globalOpStore[opId] ??= {});
  op.host = host;

  // Host updated; attempt endpoint rehydration for this op
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
