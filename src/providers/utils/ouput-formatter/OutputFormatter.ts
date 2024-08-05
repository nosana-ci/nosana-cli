import { OutputEvent } from "./outputEvents.js";
import { TextOutputFormatter } from "./text/TextOutputFormatter.js";

/**
 * Interface defining the structure for output formatter adapters.
 * Adapters implementing this interface should provide implementations
 * for handling various output events and finalizing the output.
 */
export interface OutputFormatterAdapter {
  events: { [key in OutputEvent]: (param: any) => void };
  finalize(): void;
}

/**
 * Class responsible for formatting output based on the provided adapter.
 * The adapter can be either a JSON formatter or a Text formatter (and more can be added),
 * depending on the user's choice.
 */
export class OutputFormatter {
  private format: OutputFormatterAdapter;

  constructor(format: OutputFormatterAdapter) {
    this.format = format;
  }

  /**
   * Outputs an event using the selected format.
   * @param {OutputEvent} event - The event type to be output.
   * @param {any} param - The parameters associated with the event.
   * 
   * Usage:
   * 
   * ```typescript
   * // To get a JSON formatter
   * const formatter = outputFormatSelector(true);
   * 
   * // To output an event
   * formatter.output(OUTPUT_EVENTS.EXAMPLE_OUTPUT, { log: { log: 'Job started\n' } });
   * ```
   */
  public output(event: OutputEvent, param: any) {
    this.format.events[event](param);
  }

  /**
   * Throws an event using the selected format, typically used for error handling.
   * Note: This method works similarly to `output`, but it indicates that an error has occurred.
   * After every throw event, an actual error is thrown.
   * @param {OutputEvent} event - The event type to be thrown.
   * @param {any} param - The parameters associated with the event.
   * 
   * Usage:
   * 
   * ```typescript
   * // To throw an event (usually for error handling)
   * formatter.throw(OUTPUT_EVENTS.EXAMPLE_OUTPUT, { error: 'Invalid job definition' });
   * ```
   */
  public throw(event: OutputEvent, param: any) {
    this.format.events[event](param);
    throw new Error(`An error occurred: ${event}`);
  }


  /**
   * Finalizes the output, performing any necessary cleanup or final steps.
   * 
   * Usage:
   * 
   * ```typescript
   * // Finalize the output (if needed)
   * formatter.finalize();
   * ```
   */
  public finalize() {
    this.format.finalize();
  }
}

class OutputFormatterFactory {
  static createFormatter(format: string): OutputFormatter {
    switch (format.toLowerCase()) {
      // add more formats here
      case 'text':
      default:
        return new OutputFormatter(new TextOutputFormatter());
    }
  }
}

/**
 * Singleton pattern to ensure a single instance of OutputFormatter.
 * This function selects the appropriate formatter (JSON or Text) based on the input.
 * @param {boolean} json - Flag indicating whether to use JSON formatting. If false, uses Text formatting.
 * @returns {OutputFormatter} - The singleton instance of OutputFormatter.
 * 
 * Usage:
 * 
 * ```typescript
 * // To get a Text formatter
 * const textFormatter = outputFormatSelector();
 * ```
 */
export const outputFormatSelector = (() => {
  let instance: OutputFormatter | null = null;

  return (format: string) => {
    if (!instance) {
      instance = OutputFormatterFactory.createFormatter(format);
    }
    return instance;
  };
})();
