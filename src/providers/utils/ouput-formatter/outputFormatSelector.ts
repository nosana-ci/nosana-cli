import { OutputFormatter } from './OutputFormatter.js';
import { OutputFormatterFactory } from './OutputFormatterFactory.js';

/**
 * Singleton pattern to ensure a single instance of OutputFormatter.
 * This function selects the appropriate formatter (JSON or Text) based on the input.
 * @param {string} format - Options indicating whether to use JSON formatting. If text, uses Text formatting.
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
