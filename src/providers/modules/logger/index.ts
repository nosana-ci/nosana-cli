import { ChalkInstance } from 'chalk';
import EventEmitter from 'events';

import { ProviderEvents } from '../../Provider.js';
import ora, { Ora } from 'ora';
type EnumValues<T> = T[keyof T];

type ProviderEventsValues = EnumValues<typeof ProviderEvents>;

export default class Logger extends EventEmitter {
  public spinner = ora();
  private defaultSubscriptions = new Map([
    [ProviderEvents.INFO_LOG, this.standard_info_log],
    [ProviderEvents.CONTAINER_LOG, this.standard_container_log],
  ]);
  constructor() {
    super();

    this.setDefaultListeners();
  }
  private setDefaultListeners() {
    this.defaultSubscriptions.forEach((callback, event) => {
      this.on(event, callback);
    });
  }
  public standard_info_log(
    event: {
      log: string;
      type: string;
      pending: boolean;
    },
    spinner?: Ora,
  ) {
    let logSpinner = spinner || this.spinner;
    if (event.type === 'info') {
      if (logSpinner && logSpinner.isSpinning) {
        logSpinner.succeed();
      }
      if (event.pending) {
        logSpinner.start(event.log);
      } else {
        console.log(event.log);
      }
    } else if (event.type === 'fail') {
      if (logSpinner && logSpinner.isSpinning) {
        logSpinner.fail(event.log);
      } else {
        console.log(event.log);
      }
    } else if (event.type === 'success') {
      if (logSpinner && logSpinner.isSpinning) {
        logSpinner.succeed(event.log);
      } else {
        console.log(event.log);
      }
    }
  }
  public standard_container_log(event: { log: string; type: string }) {
    // STANDARD CONTAINER STREAMING LOG IS TO NOT PRINT
  }
  override(event: ProviderEventsValues, callback: (...args: any[]) => void) {
    const defaultEvent = this.defaultSubscriptions.get(event);

    if (defaultEvent) {
      this.off(event, defaultEvent);
    }

    this.on(event, callback);
  }
  log(message: string | ChalkInstance, pending: boolean = false) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'info',
      log: message,
      pending,
    });
  }
  succeed(message?: string | ChalkInstance) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'success',
      log: message,
    });
  }
  fail(message?: string | ChalkInstance) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'fail',
      log: message,
    });
  }
}
