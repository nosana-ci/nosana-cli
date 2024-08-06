import { TextOutputFormatter } from '../TextOutputFormatter.js';
import { OUTPUT_EVENTS, OutputEvent } from '../../outputEvents.js';
import { textOutputEventHandlers } from '../TextOutputEventHandlers.js';

jest.mock('../TextOutputEventHandlers', () => {
  return {
    textOutputEventHandlers: {
      READ_KEYFILE: jest.fn(),
      CREATE_KEYFILE: jest.fn(),
      OUTPUT_JOB_URL: jest.fn(),
      OUTPUT_JSON_FLOW_URL: jest.fn(),
      OUTPUT_MARKET_URL: jest.fn(),
      OUTPUT_JOB_PRICE: jest.fn(),
      OUTPUT_JOB_STATUS: jest.fn(),
      OUTPUT_JOB_POSTED_ERROR: jest.fn(),
      OUTPUT_JOB_POSTING: jest.fn(),
      OUTPUT_NETWORK: jest.fn(),
      OUTPUT_BALANCES: jest.fn(),
      OUTPUT_WALLET: jest.fn(),
      OUTPUT_IPFS_UPLOADED: jest.fn(),
      OUTPUT_SERVICE_URL: jest.fn(),
      OUTPUT_JOB_NOT_FOUND: jest.fn(),
      OUTPUT_CANNOT_LOG_RESULT: jest.fn(),
      OUTPUT_JOB_VALIDATION_ERROR: jest.fn(),
      OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR: jest.fn(),
      OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR: jest.fn(),
      OUTPUT_SOL_BALANCE_LOW_ERROR: jest.fn(),
      OUTPUT_NOS_BALANCE_LOW_ERROR: jest.fn(),
      OUTPUT_AIRDROP_REQUEST_FAILED_ERROR: jest.fn(),
      OUTPUT_JOB_POSTED_TX: jest.fn(),
      OUTPUT_NODE_URL: jest.fn(),
      OUTPUT_DURATION: jest.fn(),
      OUTPUT_START_TIME: jest.fn(),
      OUTPUT_RESULT_URL: jest.fn(),
      OUTPUT_JOB_EXECUTION: jest.fn(),
      OUTPUT_RETRIVE_JOB_COMMAND: jest.fn(),
    },
  };
});

describe('TextOutputFormatter', () => {
  let formatter: TextOutputFormatter;

  beforeEach(() => {
    formatter = new TextOutputFormatter();
    jest.clearAllMocks();
  });

  test('should handle events and call the appropriate event handlers', () => {
    const param = { keyfile: 'test-keyfile' };
    const event = OUTPUT_EVENTS.READ_KEYFILE;

    formatter.events[event](param);
    expect(textOutputEventHandlers.READ_KEYFILE).toHaveBeenCalledWith(param);
  });

  test('should finalize and not perform any action', () => {
    formatter.finalize();
  });
});
