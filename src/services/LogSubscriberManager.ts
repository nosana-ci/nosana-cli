import EventEmitter from 'events';
import { ProviderEvents } from '../providers/Provider.js';
import { NosanaNode } from './NosanaNode.js';
import Logger from '../providers/modules/logger/index.js';

export type LogEvent = {
  index: number;
  log: string;
  type: string; // 'info' | 'fail' | 'success';
  pending: boolean;
  job: string;
};

export default class LogSubscriberManager {
  private subscribers: Set<(logEvent: LogEvent) => void> = new Set();
  private eventIndex: number = 0;
  public events: LogEvent[] = [];
  public lastProcessedLogIndex: number = -1;
  public cmdEntriesLinesCount: number = 0;

  constructor() {}

  public subscribe(callback: (logEvent: LogEvent) => void) {
    this.subscribers.add(callback);
  }

  public unsubscribe(callback: (logEvent: LogEvent) => void) {
    this.subscribers.delete(callback);
  }

  private notifySubscribers(log: LogEvent) {
    this.events.push(log);
    this.subscribers.forEach((callback) => callback(log));
  }

  private getCurrentJob(node: NosanaNode): string {
    const run = node.run;
    if (run) {
      return run.account.job.toString();
    }
    return '';
  }

  public getEvents() {
    return this.events;
  }

  public getEventIndex() {
    return this.eventIndex;
  }

  public incrementEventIndex() {
    this.eventIndex++;
  }

  public listenToLoggerEvents(logger: EventEmitter, node: NosanaNode) {
    logger.on(
      ProviderEvents.INFO_LOG,
      (event: { log: string; type: string; pending: boolean }) => {
        this.notifySubscribers({
          ...event,
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
        logger.standard_info_log({
          log: event.log,
          pending: event.pending,
          type: event.type,
        });
        this.lastProcessedLogIndex = event.index;
      }
    });
  }
}
