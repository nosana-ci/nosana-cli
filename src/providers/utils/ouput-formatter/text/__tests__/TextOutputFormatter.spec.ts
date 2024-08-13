import outputEventsMock from '../../__mocks__/outputEvents.mock.js';
import { TextOutputFormatter } from '../TextOutputFormatter.js';
import { OUTPUT_EVENTS } from '../../outputEvents.js';
import { textOutputEventHandlers } from '../TextOutputEventHandlers.js';

jest.mock('../TextOutputEventHandlers', () => {
  return {
    textOutputEventHandlers: outputEventsMock,
  };
});

describe('TextOutputFormatter', () => {
  let formatter: TextOutputFormatter;

  beforeEach(() => {
    formatter = new TextOutputFormatter();
    jest.clearAllMocks();
  });

  it('should handle events and call the appropriate event handlers', () => {
    const param = { keyfile: 'test-keyfile' };
    const event = OUTPUT_EVENTS.READ_KEYFILE;

    formatter.output(event, param);
    expect(textOutputEventHandlers.READ_KEYFILE).toHaveBeenCalledWith(param);
  });

  it('should finalize and not perform any action', () => {
    formatter.finalize();
  });
});
