import {
  buildProxyCommand,
  buildSshArgs,
  buildSshAuthorizationMessage,
} from '../action.js';

describe('ssh action helpers', () => {
  it('builds the wallet-signed SSH authorization message', () => {
    expect(
      buildSshAuthorizationMessage({
        job: 'job-123',
        node: 'node-abc',
        sshUser: 'nosana-job-123',
        sshPublicKey: 'ssh-ed25519 AAAAC3 test',
        expiresAt: '2026-06-03T23:00:00.000Z',
        network: 'devnet',
      }),
    ).toBe(
      [
        'Nosana SSH Authorization v1',
        '',
        'job: job-123',
        'node: node-abc',
        'sshUser: nosana-job-123',
        'sshPublicKey: ssh-ed25519 AAAAC3 test',
        'expiresAt: 2026-06-03T23:00:00.000Z',
        'network: devnet',
        'audience: nosana-ssh-gateway',
      ].join('\n'),
    );
  });

  it('builds OpenSSH args using the built-in Nosana proxy command', () => {
    const args = buildSshArgs({
      job: 'job-123',
      node: 'node-abc',
      serverAddr: 'node.k8s.dev.nos.ci',
      privateKeyPath: '/tmp/nosana-ssh-key',
      op: 'web',
      proxyHost: 'node.k8s.dev.nos.ci',
      proxyPort: 5002,
      strictHostKeyChecking: 'accept-new',
    });

    expect(args).toContain('/tmp/nosana-ssh-key');
    expect(args).toContain('IdentitiesOnly=yes');
    expect(args).toContain('StrictHostKeyChecking=accept-new');
    expect(args).toContain('nosana-job-123@node-abc-ssh.node.k8s.dev.nos.ci');
    expect(args.slice(-3)).toStrictEqual([
      '-t',
      'nosana-job-123@node-abc-ssh.node.k8s.dev.nos.ci',
      'web',
    ]);
    expect(args.find((arg) => arg.startsWith('ProxyCommand='))).toContain(
      'job ssh --proxy-stdio',
    );
  });

  it('builds a proxy command that targets the tcpmux http-connect port', () => {
    const command = buildProxyCommand({
      proxyHost: 'node.k8s.dev.nos.ci',
      proxyPort: 5002,
    });

    expect(command).toContain('job ssh --proxy-stdio');
    expect(command).toContain('--proxy-host node.k8s.dev.nos.ci');
    expect(command).toContain('--proxy-port 5002');
    expect(command).toContain('%h %p');
  });
});
