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
    const logSpinner = spinner || this.spinner;
    switch (event.type) {
      case 'info':
        if (logSpinner && logSpinner.isSpinning) {
          logSpinner.succeed();
        }
        if (event.pending) {
          logSpinner.start(event.log);
        } else {
          console.log(event.log);
        }
        break;
      case 'fail':
        if (logSpinner && logSpinner.isSpinning) {
          logSpinner.fail(event.log);
        } else {
          console.log(event.log);
        }
        break;
      case 'success':
        if (logSpinner && logSpinner.isSpinning) {
          logSpinner.succeed(event.log);
        } else {
          console.log(event.log);
        }
        break;
      default:
        console.log(event.log);
        break;
    }
  }

  public standard_container_log(event: { log: string; type: string }) {
    // STANDARD CONTAINER STREAMING LOG IS TO NOT PRINT
  }

  public override(
    event: ProviderEventsValues,
    callback: (...args: any[]) => void,
  ) {
    const defaultEvent = this.defaultSubscriptions.get(event);

    if (defaultEvent) {
      this.off(event, defaultEvent);
    }

    this.on(event, callback);
  }

  public log(message: string | ChalkInstance, pending: boolean = false) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'info',
      log: message,
      pending,
    });
  }

  public succeed(message?: string | ChalkInstance) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'success',
      log: message,
    });
  }

  public fail(message?: string | ChalkInstance) {
    this.emit(ProviderEvents.INFO_LOG, {
      type: 'fail',
      log: message,
    });
  }
}
