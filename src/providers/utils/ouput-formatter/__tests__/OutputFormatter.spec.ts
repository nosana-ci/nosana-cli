import { OutputFormatter, OutputFormatterAdapter } from '../OutputFormatter.js';
import { OUTPUT_EVENTS, OutputEventParams } from '../outputEvents.js';

class MockOutputFormatterAdapter implements OutputFormatterAdapter {
  public events = {
    [OUTPUT_EVENTS.READ_KEYFILE]: jest.fn(),
    [OUTPUT_EVENTS.CREATE_KEYFILE]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_BALANCES]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_NETWORK]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_WALLET]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: jest.fn((param) => { throw param.error }),
    [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_NODE_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_DURATION]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_START_TIME]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: jest.fn(),
    [OUTPUT_EVENTS.OUTPUT_RETRIVE_JOB_COMMAND]: jest.fn(),
  };

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
    const param: OutputEventParams['OUTPUT_JOB_VALIDATION_ERROR'] = { error: new Error('Validation Error') };

    expect(() => formatter.throw(OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR, param)).toThrow(`Validation Error`);
    expect(mockAdapter.events[OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]).toHaveBeenCalledWith(param);
  });

  test('should call finalize on the adapter', () => {
    formatter.finalize();
    expect(mockAdapter.finalize).toHaveBeenCalled();
  });
});
