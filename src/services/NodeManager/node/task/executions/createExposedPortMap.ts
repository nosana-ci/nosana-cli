import TaskManager, { Operation, TaskManagerOps } from "../TaskManager";

export function createExposedPortMap(
  this: TaskManager,
): Map<string, string> {
  const flow = this.repository.getflow(this.job);
  const portMap = new Map<string, string>();

  for (const op of this.operations as TaskManagerOps) {
    // Only care about container/run ops
    if (op.type !== "container/run") continue;

    const expose = (op as Operation<'container/run'>).args.expose;
    if (!expose) continue;

    // Normalize to an array of numbers
    let ports: number[] = [];

    if (typeof expose === "number") {
      ports.push(expose);
    } else if (Array.isArray(expose)) {
      for (const p of expose) {
        if (typeof p === "number") {
          ports.push(p);
        } else if (typeof p === "object" && "port" in p && typeof p.port === "number") {
          ports.push(p.port);
        }
      }
    }

    for (const port of ports) {
      portMap.set(`${op.id}:${port}`, `${flow.id}-${op.id}:${port}`);
    }
  }

  return portMap;
}
