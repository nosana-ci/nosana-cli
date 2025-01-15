import { joinCommand } from '../command';

describe('joinCommand', () => {
  it('should have 9 options', () => {
    expect(joinCommand.options.length).toBe(9);
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
    ['--gpu', undefined, 'all'],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = joinCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
