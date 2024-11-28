import WebSocket from 'ws';
import { log, LogObserver, NodeLogEntry } from '../log/NodeLog.js';

export const logStreaming = (() => {
  let instance: LogStreamer | null = null;

  return (node: string) => {
    if (!instance) {
      instance = new LogStreamer(node);
    }
    return instance;
  };
})();

export class LogStreamer implements LogObserver {
  public logs: Map<string, string[]> = new Map<string, string[]>();
  private index: number = 0;
  private clients: Map<string, WebSocket[]> = new Map();

  constructor(privatenode: string) {
    log().addObserver(this);
  }

  public update(log: NodeLogEntry) {
    const logMessage = JSON.stringify(log);
    this.index = this.index + 1;

    const job = log.job;
    if (job) {
      this.logs.set(job, (this.logs.get(job) ?? []).concat([logMessage]));
      const clients = this.clients.get(job) ?? [];
      clients.forEach((ws) => {
        ws.send(JSON.stringify({data: logMessage, path: 'log'}));
      });
    }
    this.logs.set('all', (this.logs.get('all') ?? []).concat([logMessage]));
  }

  public subscribe(ws: WebSocket, job: string) {
    this.clients.set(job, (this.clients.get(job) ?? []).concat([ws]));
    const logs = this.logs.get(job) ?? [];

    logs.forEach((log) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({data: log, path: 'log'}));
      }
    });
  }

  public unsubscribe(ws: WebSocket) {
    for (const [job, clients] of this.clients) {
      const updatedClients = clients.filter((client) => client !== ws);
      if (updatedClients.length > 0) {
        this.clients.set(job, updatedClients);
      } else {
        this.clients.delete(job);
      }
    }
  }
}
