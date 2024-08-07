import { ChalkInstance } from 'chalk';
import EventEmitter from 'events';

import { ProviderEvents } from '../../Provider.js';

export default class Logger extends EventEmitter {
  log(message: string | ChalkInstance) {
    this.emit(ProviderEvents.NEW_LOG, {
      type: 'info',
      log: message,
    });
  }
}
