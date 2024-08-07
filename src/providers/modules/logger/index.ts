import { ChalkInstance } from 'chalk';
import EventEmitter from 'events';

import { ProviderEvents } from '../../Provider.js';

export default class Logger extends EventEmitter {
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
