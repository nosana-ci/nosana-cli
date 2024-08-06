import { JsonOutputFormatter } from "../json/JsonOutputFormatter.js";
import { outputFormatSelector } from "../outputFormatSelector.js";

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

describe('outputFormatSelector', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();
      (outputFormatSelector as any).instance = null;
    });
  
    test('should return the same instance for multiple calls with JSON format', () => {
      const formatter1 = outputFormatSelector('json');
      const formatter2 = outputFormatSelector('json');
      expect(formatter1).toBe(formatter2);
      expect(JsonOutputFormatter).toHaveBeenCalledTimes(1);
    });
  
    test('should not create a new instance if called again with a different format', () => {
      const formatter1 = outputFormatSelector('json');
      const formatter2 = outputFormatSelector('text');
      expect(formatter1).toBe(formatter2);
    });
  });