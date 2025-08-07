import TaskManager, { LogType, TaskLog } from '../TaskManager.js';
import WebSocket from 'ws';

const MAX_LOGS_PER_OP = 10000000;

export function addLog(this: TaskManager, log: TaskLog) {
  if (!this.opLogBuffers.has(log.opId)) {
    this.opLogBuffers.set(log.opId, []);
  }

  const buffer = this.opLogBuffers.get(log.opId)!;
  buffer.push(log);
  if (buffer.length > MAX_LOGS_PER_OP) buffer.shift();

  for (const ws of this.subscribers) {
    const matcher = this.logMatchers.get(ws);
    if (matcher && matcher(log)) {
      try {
        ws.send(JSON.stringify({ path: 'flog', data: JSON.stringify(log) }));
      } catch (_) {}
    }
  }
}

export function getLogsByOp(this: TaskManager, opId: string): TaskLog[] {
  return this.opLogBuffers.get(opId) || [];
}

export function getLogsByGroup(this: TaskManager, group: string): TaskLog[] {
  const logs: TaskLog[] = [];
  for (const buffer of this.opLogBuffers.values()) {
    logs.push(...buffer.filter((log) => log.group === group));
  }
  return logs;
}

export function getAllLogs(this: TaskManager): TaskLog[] {
  return Array.from(this.opLogBuffers.values()).flat();
}

export function subscribe(
  this: TaskManager,
  ws: WebSocket,
  matcher: (log: TaskLog) => boolean,
) {
  this.subscribers.add(ws);
  this.logMatchers.set(ws, matcher);

  ws.on('close', () => {
    unsubscribe.call(this, ws);
  });
}

export function unsubscribe(this: TaskManager, ws: WebSocket) {
  this.subscribers.delete(ws);
  this.logMatchers.delete(ws);
}
