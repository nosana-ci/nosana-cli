import { getJobCommand } from '../command';

import { getJob } from '../action';

vi.mock('../action', () => ({
  getJob: vi.fn(),
}));

describe('getJobCommand', () => {
  const mock_get_action = vi.fn();
  const parseArgs = ['node', 'get', 'address'];

  beforeEach(() => {
    mock_get_action.mockReset();
    (getJob as any).mockImplementation(mock_get_action);
  });

  it('should call getJob action', () => {
    getJobCommand.parse(parseArgs);
    expect(mock_get_action).toHaveBeenCalledTimes(1);
  });

  it('should set get job args', () => {
    getJobCommand.parse(parseArgs);
    expect(getJobCommand.args[0]).toBe('address');
  });

  it('should have 8 options', () => {
    expect(getJobCommand.options.length).toBe(8);
  });

  it.each([
    ['--network', '-n'],
    ['--wait', undefined],
    ['--format', undefined],
    ['--rpc', undefined],
    ['--api', undefined],
    ['--download', undefined],
    ['--wallet', '-w'],
  ])('should have %s option', (long, short) => {
    const option = getJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
  });
});
