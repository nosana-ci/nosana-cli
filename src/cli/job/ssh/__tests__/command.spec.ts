import { Command } from 'commander';

import { sshJobCommand } from '../command.js';
import { sshJob, sshProxy } from '../action.js';

vi.mock('../action.js', () => ({
  sshJob: vi.fn(),
  sshProxy: vi.fn(),
}));

describe('sshJobCommand', () => {
  const parseArgs = ['node', 'ssh', 'job-address'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the ssh job action', () => {
    sshJobCommand.parse(parseArgs);

    expect(sshJob).toHaveBeenCalledWith(
      'job-address',
      expect.objectContaining({ ttl: '300', proxyPort: '5002' }),
      expect.any(Command),
    );
  });

  it.each([
    ['--op', undefined],
    ['--ttl', undefined],
    ['--proxy-host', undefined],
    ['--proxy-port', undefined],
    ['--proxy-stdio', undefined],
    ['--ssh-command', undefined],
    ['--node-url', undefined],
    ['--insecure-skip-host-key-check', undefined],
    ['--network', '-n'],
    ['--wallet', '-w'],
    ['--rpc', undefined],
    ['--format', undefined],
    ['--verbose', undefined],
  ])('has %s option', (long, short) => {
    const option = sshJobCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
  });

  it('uses the ssh proxy action in internal stdio mode', () => {
    sshJobCommand.parse([
      'node',
      'ssh',
      '--proxy-stdio',
      '--proxy-host',
      'node.k8s.dev.nos.ci',
      '--proxy-port',
      '5002',
      'target-host',
      '22',
    ]);

    expect(sshProxy).toHaveBeenCalledWith(
      'target-host',
      '22',
      expect.objectContaining({
        proxyHost: 'node.k8s.dev.nos.ci',
        proxyPort: '5002',
      }),
    );
    expect(sshJob).not.toHaveBeenCalled();
  });
});
