import WebSocket from 'ws';
import { state, StateObserver } from '../state/NodeState.js';

export const stateStreaming = (() => {
  let instance: StateStreamer | null = null;

  return (node: string) => {
    if (!instance) {
      instance = new StateStreamer(node);
    }
    return instance;
  };
})();

export class StateStreamer implements StateObserver {
  public states: Map<string, string[]> = new Map<string, string[]>();
  private index: number = 0;
  private clients: Map<string, WebSocket[]> = new Map();

  constructor(node: string) {
    state(node).addObserver(this);
  }

  public update(
    status: string,
    state: { [key: string]: string },
    timestamp: number,
  ) {
    const stateMessage = JSON.stringify({
      status,
      state,
      timestamp,
      index: this.index,
    });
    this.index = this.index + 1;
    if (state.job) {
      this.states.set(
        state.job,
        (this.states.get(state.job) ?? []).concat([stateMessage]),
      );
      const clients = this.clients.get(state.job) ?? [];
      clients.forEach((ws) => {
        ws.send(JSON.stringify({data: stateMessage, path: 'state'}));
      });
    }
    this.states.set(
      'all',
      (this.states.get('all') ?? []).concat([stateMessage]),
    );
  }

  public subscribe(ws: WebSocket, job: string) {
    this.clients.set(job, (this.clients.get(job) ?? []).concat([ws]));
    const states = this.states.get(job) ?? [];

    states.forEach((state) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({data: state, path: 'state'}));
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
