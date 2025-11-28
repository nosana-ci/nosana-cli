import { startNodeCommand } from '../command';

import { startNode } from '../action';

vi.mock('../action', () => ({
  startNode: vi.fn(),
}));

describe('startNodeCommand', () => {
  const mock_start_node_action = vi.fn();
  const parseArgs = ['node', 'start', 'market address'];

  beforeEach(() => {
    mock_start_node_action.mockReset();
    (startNode as any).mockImplementation(mock_start_node_action);
  });

  it('should call startNode action', () => {
    startNodeCommand.parse(parseArgs);
    expect(mock_start_node_action).toHaveBeenCalledTimes(1);
  });

  it('should set start node args', () => {
    startNodeCommand.parse(parseArgs);
    expect(startNodeCommand.args[0]).toBe('market address');
  });

  it('should have 9 options', () => {
    expect(startNodeCommand.options.length).toBe(9);
  });

  it.each([
    ['--network', '-n', 'mainnet'],
    ['--rpc', undefined, undefined],
    ['--wallet', '-w', '~/.nosana/nosana_key.json'],
    ['--provider', undefined, 'podman'],
    ['--config', '-c', '~/.nosana/'],
    ['--port', '-p', 5001],
    ['--podman', '--docker', '~/.nosana/podman/podman.sock'],
    ['--gpu', undefined, 'all'],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = startNodeCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
