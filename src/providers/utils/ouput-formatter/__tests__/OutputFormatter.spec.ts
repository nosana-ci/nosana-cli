import { OutputFormatter, OutputFormatterAdapter } from '../OutputFormatter.js';
import outputEventsMock from "../__mocks__/outputEvents.mock.js";
import { OUTPUT_EVENTS, OutputEventParams } from '../outputEvents.js';

class MockOutputFormatterAdapter implements OutputFormatterAdapter {
  public events = outputEventsMock;
  public finalize = jest.fn();
}

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockAdapter: MockOutputFormatterAdapter;

  beforeEach(() => {
    mockAdapter = new MockOutputFormatterAdapter();
    formatter = new OutputFormatter(mockAdapter);
  });

  test('should call the appropriate event handler', () => {
    const param: OutputEventParams['OUTPUT_JOB_URL'] = { job_url: 'http://example.com' };
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_URL, param);

    expect(mockAdapter.events[OUTPUT_EVENTS.OUTPUT_JOB_URL]).toHaveBeenCalledWith(param);
  });

  test('should call the appropriate event handler for throw and throw error', () => {
    const param: OutputEventParams['OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR'] = { error: new Error('ARTIFACT NOT SUPPORT') };

    expect(() => formatter.throw(OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR, param)).toThrow('ARTIFACT NOT SUPPORT');
    expect(mockAdapter.events[OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]).toHaveBeenCalledWith(param);
  });

  test('should call finalize on the adapter', () => {
    formatter.finalize();
    expect(mockAdapter.finalize).toHaveBeenCalled();
  });
});
