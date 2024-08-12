import { getJobCommand } from '../command';

import { getJob } from '../action';

jest.mock('../action', () => ({
  getJob: jest.fn(),
}));

describe('getJobCommand', () => {
  const mock_get_action = jest.fn();
  const parseArgs = ['node', 'get', 'address'];

  beforeEach(() => {
    mock_get_action.mockReset();
    (getJob as jest.Mock).mockImplementation(mock_get_action);
  });

  it('should call getJob action', () => {
    getJobCommand.parse(parseArgs);
    expect(mock_get_action).toHaveBeenCalledTimes(1);
  });

  it('should set get job args', () => {
    getJobCommand.parse(parseArgs);
    expect(getJobCommand.args[0]).toBe('address');
  });

  it('should have 6 options', () => {
    expect(getJobCommand.options.length).toBe(6);
  });

  it.each([
    ['--network', '-n'],
    ['--wait', undefined],
    ['--format', undefined],
    ['--rpc', undefined],
    ['--download', undefined],
  ])('should have %s option', (long, short) => {
    const option = getJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
  });
});
