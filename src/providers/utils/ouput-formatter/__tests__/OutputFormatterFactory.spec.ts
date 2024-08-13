import '../__mocks__/outputFormatter.mock.js';
import { JsonOutputFormatter } from '../json/JsonOutputFormatter.js';
import { OutputFormatter } from '../OutputFormatter.js';
import { OutputFormatterFactory } from '../OutputFormatterFactory.js';
import { TextOutputFormatter } from '../text/TextOutputFormatter.js';

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('OutputFormatterFactory', () => {
  it('should create a JSON formatter', () => {
    const formatter = OutputFormatterFactory.createFormatter('json');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(JsonOutputFormatter).toHaveBeenCalled();
  });

  it('should create a Text formatter by default', () => {
    const formatter = OutputFormatterFactory.createFormatter('text');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(TextOutputFormatter).toHaveBeenCalled();
  });

  it('should create a Text formatter for unknown format', () => {
    const formatter = OutputFormatterFactory.createFormatter('unknown');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(TextOutputFormatter).toHaveBeenCalled();
  });
});
