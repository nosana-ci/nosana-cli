import { OutputEvent, OutputEventParams } from './outputEvents.js';

/**
 * Interface defining the structure for output formatter adapters.
 * Adapters implementing this interface should provide implementations
 * for handling various output events and finalizing the output.
 */
export interface OutputFormatterAdapter {
  finalize(): void;
  output<T extends keyof OutputEventParams>(
    event: T,
    param: OutputEventParams[T],
  ): void;
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
   * @param {T} param - The parameters associated with the event.
   *
   * Usage:
   *
   * ```typescript
   * // To get a JSON formatter
   * const formatter = outputFormatSelector('json');
   *
   * // To output an event
   * formatter.output(OUTPUT_EVENTS.EXAMPLE_OUTPUT, { log: { log: 'Job started\n' } });
   * ```
   */
  public output<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
    this.format.output(event, param);
  }

  /**
   * Throws an event using the selected format, typically used for error handling.
   * Note: This method works similarly to `output`, but it indicates that an error has occurred.
   * After every throw event, an actual error is thrown.
   * @param {OutputEvent} event - The event type to be thrown.
   * @param {T} param - The parameters associated with the event.
   *
   * Usage:
   *
   * ```typescript
   * // To throw an event (usually for error handling)
   * formatter.throw(OUTPUT_EVENTS.EXAMPLE_OUTPUT, { error: 'Invalid job definition' });
   * ```
   */
  public throw<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
    this.format.output(event, param);
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
