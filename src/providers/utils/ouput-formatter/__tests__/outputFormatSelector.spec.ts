import '../__mocks__/outputFormatter.mock.js';
import { JsonOutputFormatter } from '../json/JsonOutputFormatter.js';
import { outputFormatSelector } from '../outputFormatSelector.js';

describe('outputFormatSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    (outputFormatSelector as any).instance = null;
  });

  it('should return the same instance for multiple calls with JSON format', () => {
    const formatter1 = outputFormatSelector('json');
    const formatter2 = outputFormatSelector('json');
    expect(formatter1).toBe(formatter2);
    expect(JsonOutputFormatter).toHaveBeenCalledTimes(1);
  });

  it('should not create a new instance if called again with a different format', () => {
    const formatter1 = outputFormatSelector('json');
    const formatter2 = outputFormatSelector('text');
    expect(formatter1).toBe(formatter2);
  });
});
