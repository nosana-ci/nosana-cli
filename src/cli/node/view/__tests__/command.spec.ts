import { viewNodeCommand } from '../command';

import { view } from '../action';

jest.mock('../action', () => ({
  view: jest.fn(),
}));

describe('viewNodeCommand', () => {
  const mock_run_job_action = jest.fn();
  const parseArgs = ['node', 'run', 'job definition path'];

  beforeEach(() => {
    mock_run_job_action.mockReset();
    (view as jest.Mock).mockImplementation(mock_run_job_action);
  });

  it('should call view action', () => {
    viewNodeCommand.parse(parseArgs);
    expect(mock_run_job_action).toHaveBeenCalledTimes(1);
  });

  it('should set view node args', () => {
    viewNodeCommand.parse(parseArgs);
    expect(viewNodeCommand.args[0]).toBe('job definition path');
  });

  it('should have 2 options', () => {
    expect(viewNodeCommand.options.length).toBe(2);
  });

  it.each([
    ['--network', '-n', 'mainnet'],
    ['--rpc', undefined, undefined],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = viewNodeCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
