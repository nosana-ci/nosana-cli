import EventEmitter from 'events';
import { ProviderEvents } from '../providers/Provider.js';
import { NosanaNode } from './NosanaNode.js';
import Logger from '../providers/modules/logger/index.js';
import express, { Request, Response } from 'express';
import { subscribe as NodeSubscribe } from './state/node/subscribe.js';
import { subscribe as JobSubscribe } from './state/job/subscribe.js';

export type StateEvent = {
  index: number;
  type: string;
  event: any;
};

export type StatusEventClient = {
  response: Response;
  jobId: string;
};

export default class StateEventSubscriberManager {
  private subscribers: Set<(event: StateEvent) => void> = new Set();
  private eventIndex: number = 0;
  public events: Map<string, StateEvent[]> = new Map<string, StateEvent[]>();
  public lastProcessedLogIndex: number = -1;
  private stateEventStatusClients: StatusEventClient[] = [];

  constructor() {}

  public subscribe(callback: (stateEvent: StateEvent) => void) {
    this.subscribers.add(callback);
  }

  public unsubscribe(callback: (stateEvent: StateEvent) => void) {
    this.subscribers.delete(callback);
  }

  public addClient(response: Response, jobId: string) {
    this.stateEventStatusClients.push({ response, jobId });

    const events = this.getEvents(jobId);
    response.write(`data: ${JSON.stringify(events)}\n\n`);

    response.on('close', () => {
      this.removeClient(response);
    });
  }

  public removeClient(response: Response) {
    const index = this.stateEventStatusClients.findIndex(
      (client) => client.response === response,
    );
    if (index !== -1) {
      this.stateEventStatusClients.splice(index, 1);
    }
  }

  public notifySubscribers(log: StateEvent) {
    this.addEvent(log.event.job, log);
    this.subscribers.forEach((callback) => callback(log));

    this.stateEventStatusClients.forEach((client) => {
      if (log.event.job === client.jobId) {
        client.response.write(`data: ${JSON.stringify([log])}\n\n`);
      }
    });
  }

  public getEvents(jobId: string) {
    return this.events.get(jobId) || [];
  }

  public addEvent(jobId: string, log: StateEvent) {
    this.events.set(jobId, this.getEvents(jobId).concat([log]));
  }

  public getEventIndex() {
    return this.eventIndex;
  }

  public incrementEventIndex() {
    this.eventIndex++;
  }

  public listenToJobState() {
    JobSubscribe((entry) => {
      this.notifySubscribers({
        index: this.getEventIndex(),
        type: 'job',
        event: entry,
      });
    });
  }
}
