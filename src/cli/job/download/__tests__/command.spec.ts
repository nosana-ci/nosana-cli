import { downloadJobCommand } from '../command';

import { download } from '../action';

jest.mock('../action', () => ({
  download: jest.fn(),
}));

describe('downloadJobCommand', () => {
  const mock_download_action = jest.fn();
  const parseArgs = ['node', 'download', 'ipfs hash', 'path to artifact'];

  beforeEach(() => {
    mock_download_action.mockReset();
    (download as jest.Mock).mockImplementation(mock_download_action);
  });

  it('should call download action', () => {
    downloadJobCommand.parse(parseArgs);
    expect(mock_download_action).toHaveBeenCalledTimes(1);
  });

  it('should set ipfs has and artifact path args', () => {
    downloadJobCommand.parse(parseArgs);
    expect(downloadJobCommand.args[0]).toBe('ipfs hash');
    expect(downloadJobCommand.args[1]).toBe('path to artifact');
  });

  it('should have 2 options', () => {
    expect(downloadJobCommand.options.length).toBe(2);
  });

  it.each([
    ['--network', '-n'],
    ['--rpc', undefined],
  ])('should have %s option', (long, short) => {
    const option = downloadJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
  });
});
