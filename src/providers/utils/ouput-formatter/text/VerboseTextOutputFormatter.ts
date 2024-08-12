import { OutputEvent, OutputEventParams } from '../outputEvents.js';
import { OutputFormatterAdapter } from '../OutputFormatter.js';
import { verboseTextOutputEventHandlers } from './VerboseTextOutputEventHandlers.js';

export class VerboseTextOutputFormatter implements OutputFormatterAdapter {
  finalize() {}

  output<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
    verboseTextOutputEventHandlers[event](param);
  }
}
