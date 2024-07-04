import { runNodeCommand } from '../command';

import { runJob } from '../action';

jest.mock('../action', () => ({
  runJob: jest.fn(),
}));

describe('runNodeCommand', () => {
  const mock_run_job_action = jest.fn();
  const parseArgs = ['node', 'run', 'job definition path'];

  beforeEach(() => {
    mock_run_job_action.mockReset();
    (runJob as jest.Mock).mockImplementation(mock_run_job_action);
  });

  it('should call runJob action', () => {
    runNodeCommand.parse(parseArgs);
    expect(mock_run_job_action).toHaveBeenCalledTimes(1);
  });

  it('should set run job args', () => {
    runNodeCommand.parse(parseArgs);
    expect(runNodeCommand.args[0]).toBe('job definition path');
  });

  it('should have 3 options', () => {
    expect(runNodeCommand.options.length).toBe(3);
  });

  it.each([
    ['--provider', undefined, 'podman'],
    ['--config', '-c', '~/.nosana/'],
    ['--podman', '--docker', 'http://localhost:8080'],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = runNodeCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
