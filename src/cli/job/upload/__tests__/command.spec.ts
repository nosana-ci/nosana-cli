import { uploadJobCommand } from '../command';

import { upload } from '../action';

jest.mock('../action', () => ({
  upload: jest.fn(),
}));

describe('uploadJobCommand', () => {
  const mock_upload_action = jest.fn();
  const parseArgs = ['node', 'upload', 'file path'];

  beforeEach(() => {
    mock_upload_action.mockReset();
    (upload as jest.Mock).mockImplementation(mock_upload_action);
  });

  it('should call upload action', () => {
    uploadJobCommand.parse(parseArgs);
    expect(mock_upload_action).toHaveBeenCalledTimes(1);
  });

  it('should set upload job args', () => {
    uploadJobCommand.parse(parseArgs);
    expect(uploadJobCommand.args[0]).toBe('file path');
  });

  it('should have 2 options', () => {
    expect(uploadJobCommand.options.length).toBe(2);
  });

  it.each([
    ['--network', '-n', 'mainnet'],
    ['--rpc', undefined, undefined],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = uploadJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
