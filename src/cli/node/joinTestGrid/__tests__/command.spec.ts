import { joinTestGridCommand } from '../command';

import { runBenchmark } from '../action';

jest.mock('../action', () => ({
  runBenchmark: jest.fn(),
}));

describe('joinTestGridCommand', () => {
  const mock_runBenchmark_action = jest.fn();
  const parseArgs = ['node', 'get', 'run command'];

  beforeEach(() => {
    mock_runBenchmark_action.mockReset();
    (runBenchmark as jest.Mock).mockImplementation(mock_runBenchmark_action);
  });

  it('should call runBenchmark action', () => {
    joinTestGridCommand.parse(parseArgs);
    expect(mock_runBenchmark_action).toHaveBeenCalledTimes(1);
  });

  it('should have 8 options', () => {
    expect(joinTestGridCommand.options.length).toBe(8);
  });

  it.each([
    ['--provider', undefined, 'podman'],
    ['--podman', '--docker', 'http://localhost:8080'],
    ['--wallet', '-w', '~/.nosana/nosana_key.json'],
    ['--network', '-n', 'mainnet'],
    ['--rpc', undefined, undefined],
    ['--airdrop', undefined, true],
    ['--config', '-c', '~/.nosana/'],
    ['--no-airdrop', undefined, undefined],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = joinTestGridCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
