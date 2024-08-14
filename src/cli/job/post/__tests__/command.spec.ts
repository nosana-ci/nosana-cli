import { postJobCommand } from '../command';

import { run } from '../action';

jest.mock('../action', () => ({
  run: jest.fn(),
}));

describe('postJobCommand', () => {
  const mock_run_action = jest.fn();
  const parseArgs = ['node', 'post', '-m id', 'run command'];

  beforeEach(() => {
    mock_run_action.mockReset();
    (run as jest.Mock).mockImplementation(mock_run_action);
  });

  it('should call run action', () => {
    postJobCommand.parse(parseArgs);
    expect(mock_run_action).toHaveBeenCalledTimes(1);
  });

  it('should set post job args', () => {
    postJobCommand.parse(parseArgs);
    expect(postJobCommand.args[0]).toBe('run command');
  });

  it('should have 15 options', () => {
    expect(postJobCommand.options.length).toBe(15);
  });

  it.each([
    ['--network', '-n', 'mainnet'],
    ['--rpc', undefined, undefined],
    ['--airdrop', undefined, true],
    ['--no-airdrop', undefined, undefined],
    ['--gpu', undefined, undefined],
    ['--output', '-o', undefined],
    ['--market', '-m', undefined],
    ['--wallet', '-w', '~/.nosana/nosana_key.json'],
    ['--type', undefined, 'container'],
    ['--image', '-i', 'ubuntu'],
    ['--file', '-f', undefined],
    ['--file', '-f', undefined],
    ['--wait', undefined, undefined],
    ['--verbose', undefined, undefined],
    ['--format', undefined, 'text'],
    ['--download', undefined, undefined],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = postJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
