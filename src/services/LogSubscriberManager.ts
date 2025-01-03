import EventEmitter from 'events';
import { ProviderEvents } from '../providers/Provider.js';
import { NosanaNode } from './NosanaNode.js';
import Logger from '../providers/modules/logger/index.js';
import express, { Request, Response } from 'express';
import { subscribe as NodeSubscribe } from './state/node/subscribe.js';
import { subscribe as JobSubscribe } from './state/job/subscribe.js';

export type LogEvent = {
  index: number;
  log: string;
  type: string; // 'info' | 'fail' | 'success';
  pending: boolean;
  job: string;
  event: string;
};

export type LogTypes = 'infoLog' | 'jobLog' | 'containerLog';

export type StatusLogClient = {
  response: Response;
  jobId: string;
  logType?: LogTypes;
};

export default class LogSubscriberManager {
  private subscribers: Set<(logEvent: LogEvent) => void> = new Set();
  private eventIndex: number = 0;
  public events: Map<string, LogEvent[]> = new Map<string, LogEvent[]>();
  public lastProcessedLogIndex: number = -1;
  private logStatusClients: StatusLogClient[] = [];

  constructor() {}

  public subscribe(callback: (logEvent: LogEvent) => void) {
    this.subscribers.add(callback);
  }

  public unsubscribe(callback: (logEvent: LogEvent) => void) {
    this.subscribers.delete(callback);
  }

  public addClient(response: Response, jobId: string, logType?: LogTypes) {
    this.logStatusClients.push({ response, jobId, logType });

    const events = this.getEvents(jobId, logType);
    if (events.length > 0) {
      response.write(`data: ${JSON.stringify(events)}\n\n`);
    }

    // TODO: FIX AS THIS DOES NOT GET CALLED
    response.on('close', () => {
      this.removeClient(response);
    });
  }

  public removeClient(response: Response) {
    const index = this.logStatusClients.findIndex(
      (client) => client.response === response,
    );
    if (index !== -1) {
      this.logStatusClients = this.logStatusClients.splice(index, 1);
    }
  }

  public notifySubscribers(log: LogEvent) {
    this.addEvent(log.job, log);
    this.subscribers.forEach((callback) => callback(log));

    this.logStatusClients.forEach(({ jobId, response, logType }) => {
      if (log.job === jobId) {
        if (!logType || logType === log.event) {
          response.write(`data: ${JSON.stringify([log])}\n\n`);
        }
      }
    });
  }

  private getCurrentJob(node: NosanaNode): string {
    const run = node.run;
    if (run) {
      return run.account.job.toString();
    }
    return 'default';
  }

  public getEvents(jobId: string, logType?: LogTypes) {
    let events = this.events.get(jobId) || [];

    if (logType) events = events.filter(({ event }) => event === logType);

    return events;
  }

  public addEvent(jobId: string, log: LogEvent) {
    this.events.set(jobId, this.getEvents(jobId).concat([log]));
  }

  public getEventIndex() {
    return this.eventIndex;
  }

  public incrementEventIndex() {
    this.eventIndex++;
  }

  public listenToLoggerEvents(logger: EventEmitter, node: NosanaNode) {
    JobSubscribe((entry) => {
      this.notifySubscribers({
        log: JSON.stringify(entry),
        pending: false,
        type: '',
        job: this.getCurrentJob(node),
        index: this.getEventIndex(),
        event: 'jobLog',
      });
      this.incrementEventIndex();
    });

    NodeSubscribe((entry) => {
      this.notifySubscribers({
        log: JSON.stringify(entry),
        pending: false,
        type: '',
        job: '',
        index: this.getEventIndex(),
        event: 'nodeLog',
      });
      this.incrementEventIndex();
    });

    logger.on(
      ProviderEvents.INFO_LOG,
      (event: { log: string; type: string; pending: boolean }) => {
        this.notifySubscribers({
          ...event,
          event: ProviderEvents.INFO_LOG,
          index: this.getEventIndex(),
          job: this.getCurrentJob(node),
        });
        this.incrementEventIndex();
      },
    );

    logger.on(
      ProviderEvents.CONTAINER_LOG,
      (event: { log: string; type: string; pending: boolean }) => {
        this.notifySubscribers({
          ...event,
          event: ProviderEvents.CONTAINER_LOG,
          index: this.getEventIndex(),
          job: this.getCurrentJob(node),
        });
        this.incrementEventIndex();
      },
    );
  }

  public handleRemoteLogEvents(events: LogEvent[], logger: Logger) {
    events.sort((a, b) => a.index - b.index);

    events.forEach((event) => {
      if (event.index >= this.lastProcessedLogIndex + 1) {
        if (event.event === ProviderEvents.INFO_LOG) {
          logger.standard_info_log({
            log: event.log,
            pending: false,
            type: event.type,
          });
        }
        if (event.event === ProviderEvents.CONTAINER_LOG) {
          process.stdout.write(event.log);
        }
        this.lastProcessedLogIndex = event.index;
      }
    });
  }
}
