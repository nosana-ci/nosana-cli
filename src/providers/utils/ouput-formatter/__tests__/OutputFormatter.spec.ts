import { OutputFormatter, OutputFormatterAdapter } from '../OutputFormatter.js';
import { OUTPUT_EVENTS, OutputEventParams } from '../outputEvents.js';

class MockOutputFormatterAdapter implements OutputFormatterAdapter {
  public finalize = jest.fn();
  public output = jest.fn();
}

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockAdapter: MockOutputFormatterAdapter;

  beforeEach(() => {
    mockAdapter = new MockOutputFormatterAdapter();
    formatter = new OutputFormatter(mockAdapter);
  });

  it('should call the appropriate event handler', () => {
    const param: OutputEventParams['OUTPUT_JOB_URL'] = {
      job_url: 'http://example.com',
    };
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_URL, param);

    expect(mockAdapter.output).toHaveBeenCalledWith(
      OUTPUT_EVENTS.OUTPUT_JOB_URL,
      param,
    );
  });

  it('should call the appropriate event handler for throw and throw error', () => {
    const param: OutputEventParams['OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR'] = {
      error: new Error('ARTIFACT NOT SUPPORT'),
    };

    formatter.throw(
      OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR,
      param,
    );
    expect(mockAdapter.output).toHaveBeenCalledWith(
      OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR,
      param,
    );
  });

  it('should call finalize on the adapter', () => {
    formatter.finalize();
    expect(mockAdapter.finalize).toHaveBeenCalled();
  });
});
