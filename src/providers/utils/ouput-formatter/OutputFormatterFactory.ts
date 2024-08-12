import { JsonOutputFormatter } from './json/JsonOutputFormatter.js';
import { OutputFormatter } from './OutputFormatter.js';
import { TextOutputFormatter } from './text/TextOutputFormatter.js';
import { VerboseTextOutputFormatter } from './text/VerboseTextOutputFormatter.js';

export class OutputFormatterFactory {
  static createFormatter(format: string): OutputFormatter {
    switch (format?.toLowerCase() ?? '') {
      // add more formats here
      case 'json':
        return new OutputFormatter(new JsonOutputFormatter());
      case 'verbose:text':
        return new OutputFormatter(new VerboseTextOutputFormatter());
      case 'text':
      default:
        return new OutputFormatter(new TextOutputFormatter());
    }
  }
}
