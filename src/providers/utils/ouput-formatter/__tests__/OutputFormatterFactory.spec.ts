import { JsonOutputFormatter } from "../json/JsonOutputFormatter.js";
import { OutputFormatter } from "../OutputFormatter.js";
import { OutputFormatterFactory } from "../OutputFormatterFactory.js";
import { TextOutputFormatter } from "../text/TextOutputFormatter.js";

jest.mock('../json/JsonOutputFormatter', () => {
  return {
    JsonOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        events: {},
        finalize: jest.fn(),
      };
    }),
  };
});

jest.mock('../text/TextOutputFormatter', () => {
  return {
    TextOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        events: {},
        finalize: jest.fn(),
      };
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('OutputFormatterFactory', () => {
  test('should create a JSON formatter', () => {
    const formatter = OutputFormatterFactory.createFormatter('json');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(JsonOutputFormatter).toHaveBeenCalled();
  });

  test('should create a Text formatter by default', () => {
    const formatter = OutputFormatterFactory.createFormatter('text');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(TextOutputFormatter).toHaveBeenCalled();
  });

  test('should create a Text formatter for unknown format', () => {
    const formatter = OutputFormatterFactory.createFormatter('unknown');
    expect(formatter).toBeInstanceOf(OutputFormatter);
    expect(TextOutputFormatter).toHaveBeenCalled();
  });
});