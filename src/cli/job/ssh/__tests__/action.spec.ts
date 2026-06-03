import net from 'net';

import {
  buildProxyCommand,
  buildSshArgs,
  buildSshAuthorizationMessage,
  sshProxy,
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

  it('writes proxied SSH bytes once after the CONNECT response', async () => {
    const server = net.createServer((socket) => {
      socket.once('data', () => {
        socket.write('HTTP/1.1 200 OK\r\n\r\nfirst');
        setTimeout(() => socket.end('second'), 5);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }

    const writes: Buffer[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      });

    try {
      await sshProxy('target-host', '22', {
        proxyHost: '127.0.0.1',
        proxyPort: address.port,
      });
    } finally {
      stdoutWrite.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    expect(Buffer.concat(writes).toString('utf8')).toBe('firstsecond');
  });
});
