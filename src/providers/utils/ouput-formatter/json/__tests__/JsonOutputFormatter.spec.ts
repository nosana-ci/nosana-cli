import outputEventsMock from '../../__mocks__/outputEvents.mock.js';
import { JsonOutputFormatter } from '../JsonOutputFormatter.js';
import { OUTPUT_EVENTS } from '../../outputEvents.js';
import { jsonOutputEventHandlers } from '../JsonOutputEventHandlers.js';

jest.mock('../JsonOutputEventHandlers', () => {
  return {
    jsonOutputEventHandlers: outputEventsMock,
  };
});

describe('JsonOutputFormatter', () => {
  let formatter: JsonOutputFormatter;

  beforeEach(() => {
    formatter = new JsonOutputFormatter();
    jest.clearAllMocks();
  });

  it('should handle events and call the appropriate event handlers', () => {
    const param = { keyfile: 'test-keyfile' };
    const event = OUTPUT_EVENTS.READ_KEYFILE;

    formatter.output(event, param);
    expect(jsonOutputEventHandlers.READ_KEYFILE).toHaveBeenCalledWith(
      formatter['response'],
      param,
    );
  });

  it('should set isError to undefined initially', () => {
    const param = { keyfile: 'test-keyfile' };
    const event = OUTPUT_EVENTS.READ_KEYFILE;

    formatter.output(event, param);
    expect(formatter['response'].isError).toBe(undefined);
  });

  it('should finalize and print JSON response', () => {
    console.log = jest.fn();
    const param = { keyfile: 'test-keyfile' };
    const event = OUTPUT_EVENTS.READ_KEYFILE;

    formatter.output(event, param);
    formatter.finalize();

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(formatter['response'], null, 2),
    );
  });
});
