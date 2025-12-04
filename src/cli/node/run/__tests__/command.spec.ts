import { runNodeCommand } from '../command';

import { runJob } from '../action';

vi.mock('../action', () => ({
  runJob: vi.fn(),
}));

describe('runNodeCommand', () => {
  const mock_run_job_action = vi.fn();
  const parseArgs = ['node', 'run', 'job definition path'];

  beforeEach(() => {
    mock_run_job_action.mockReset();
    (runJob as any).mockImplementation(mock_run_job_action);
  });

  it('should call runJob action', () => {
    runNodeCommand.parse(parseArgs);
    expect(mock_run_job_action).toHaveBeenCalledTimes(1);
  });

  it('should set run job args', () => {
    runNodeCommand.parse(parseArgs);
    expect(runNodeCommand.args[0]).toBe('job definition path');
  });

  it('should have 7 options', () => {
    expect(runNodeCommand.options.length).toBe(7);
  });

  it.each([
    ['--provider', undefined, 'podman'],
    ['--config', '-c', '~/.nosana/'],
    ['--podman', '--docker', '~/.nosana/podman/podman.sock'],
    ['--url', undefined, undefined],
    ['--gpu', undefined, 'all'],
    ['--verbose', undefined, undefined],
    ['--wallet', '-w', '~/.nosana/nosana_key.json'],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = runNodeCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
