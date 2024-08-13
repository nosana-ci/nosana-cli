import { OutputEvent, OutputEventParams } from '../outputEvents.js';
import { OutputFormatterAdapter } from '../OutputFormatter.js';
import { textOutputEventHandlers } from './TextOutputEventHandlers.js';

export class TextOutputFormatter implements OutputFormatterAdapter {
  finalize() {}

  output<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
    textOutputEventHandlers[event](param);
  }
}
