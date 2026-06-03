import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { Command } from 'commander';
import { Client } from '@nosana/sdk';

import { configs } from '../../../services/NodeManager/configs/configs.js';
import { getSDK } from '../../../services/sdk.js';

const SSH_AUTHORIZATION_MAX_TTL_SECONDS = 5 * 60;
const SSH_AUTHORIZATION_AUDIENCE = 'nosana-ssh-gateway';

type SshJobOptions = {
  op?: string;
  ttl?: string | number;
  proxyHost?: string;
  proxyPort?: string | number;
  sshCommand?: string;
  nodeUrl?: string;
  insecureSkipHostKeyCheck?: boolean;
  network?: 'devnet' | 'mainnet';
  proxyStdio?: boolean;
};

type SshProxyOptions = {
  proxyHost: string;
  proxyPort: string | number;
};

export async function sshJob(
  jobAddress: string,
  options: SshJobOptions,
  _cmd: Command | undefined,
): Promise<void> {
  const nosana: Client = getSDK();
  const config = configs(options);
  const job = await nosana.jobs.get(jobAddress);

  if (!job) {
    throw new Error(`Could not find job ${jobAddress}`);
  }
  if (job.state !== 'RUNNING') {
    throw new Error(`Job ${jobAddress} is not running`);
  }
  if (!job.node) {
    throw new Error(`Job ${jobAddress} does not have an assigned node`);
  }

  const key = createEphemeralSshKey(jobAddress);
  const expiresAt = new Date(Date.now() + parseTtlSeconds(options.ttl) * 1000);

  try {
    const sshUser = getSshUserForJob(jobAddress);
    const message = buildSshAuthorizationMessage({
      job: jobAddress,
      node: job.node.toString(),
      sshUser,
      sshPublicKey: key.publicKey,
      expiresAt: expiresAt.toISOString(),
      network: options.network ?? config.network,
    });

    const signature = await nosana.solana.signMessage(message);
    const nodeUrl =
      options.nodeUrl ?? `https://${job.node}.${config.frp.serverAddr}`;

    const response = await fetch(`${nodeUrl}/job/${jobAddress}/ssh/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        signature: Buffer.from(signature as Uint8Array).toString('base64'),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `SSH authorization failed: ${response.status} ${await response.text()}`,
      );
    }

    const sshArgs = buildSshArgs({
      job: jobAddress,
      node: job.node.toString(),
      serverAddr: config.frp.serverAddr,
      privateKeyPath: key.privateKeyPath,
      op: options.op,
      proxyHost: options.proxyHost ?? config.frp.serverAddr,
      proxyPort: options.proxyPort ?? 5002,
      strictHostKeyChecking: options.insecureSkipHostKeyCheck
        ? 'no'
        : 'accept-new',
    });

    await runInteractiveCommand(options.sshCommand ?? 'ssh', sshArgs);
  } finally {
    fs.rmSync(key.dir, { recursive: true, force: true });
  }
}

export async function sshProxy(
  targetHost: string,
  targetPort: string,
  options: SshProxyOptions,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect(
      Number(options.proxyPort),
      options.proxyHost,
      () => {
        socket.write(
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`,
        );
      },
    );

    let response = Buffer.alloc(0);
    const onConnectResponse = (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      const responseEnd = response.indexOf('\r\n\r\n');
      if (responseEnd === -1) return;

      const header = response.toString('utf8', 0, responseEnd);
      if (!/^HTTP\/\d(?:\.\d)? 2\d\d\b/.test(header)) {
        socket.destroy();
        reject(
          new Error(`SSH proxy CONNECT failed: ${header.split('\r\n')[0]}`),
        );
        return;
      }

      socket.off('data', onConnectResponse);
      const remainder = response.subarray(responseEnd + 4);
      if (remainder.length > 0) process.stdout.write(remainder);
      process.stdin.pipe(socket);
      socket.pipe(process.stdout);
    };

    socket.on('data', onConnectResponse);

    socket.on('error', reject);
    socket.on('close', () => resolve());
  });
}

export function buildSshAuthorizationMessage({
  job,
  node,
  sshUser,
  sshPublicKey,
  expiresAt,
  network,
}: {
  job: string;
  node: string;
  sshUser: string;
  sshPublicKey: string;
  expiresAt: string;
  network: string;
}): string {
  return [
    'Nosana SSH Authorization v1',
    '',
    `job: ${job}`,
    `node: ${node}`,
    `sshUser: ${sshUser}`,
    `sshPublicKey: ${sshPublicKey}`,
    `expiresAt: ${expiresAt}`,
    `network: ${network}`,
    `audience: ${SSH_AUTHORIZATION_AUDIENCE}`,
  ].join('\n');
}

export function buildSshArgs({
  job,
  node,
  serverAddr,
  privateKeyPath,
  op,
  proxyHost,
  proxyPort,
  strictHostKeyChecking,
}: {
  job: string;
  node: string;
  serverAddr: string;
  privateKeyPath: string;
  op?: string;
  proxyHost: string;
  proxyPort: string | number;
  strictHostKeyChecking: 'accept-new' | 'no';
}): string[] {
  const args = [
    '-i',
    privateKeyPath,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    `StrictHostKeyChecking=${strictHostKeyChecking}`,
    '-o',
    `ProxyCommand=${buildProxyCommand({ proxyHost, proxyPort })}`,
  ];

  if (op) args.push('-t');

  args.push(`${getSshUserForJob(job)}@${node}-ssh.${serverAddr}`);

  if (op) args.push(op);

  return args;
}

export function buildProxyCommand({
  proxyHost,
  proxyPort,
}: {
  proxyHost: string;
  proxyPort: string | number;
}): string {
  return [
    process.execPath,
    ...process.execArgv,
    process.argv[1],
    'job',
    'ssh',
    '--proxy-stdio',
    '--proxy-host',
    proxyHost,
    '--proxy-port',
    proxyPort.toString(),
    '%h',
    '%p',
  ]
    .map(shellQuote)
    .join(' ');
}

function createEphemeralSshKey(job: string): {
  dir: string;
  privateKeyPath: string;
  publicKey: string;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nosana-ssh-'));
  const privateKeyPath = path.join(dir, 'id_ed25519');
  const result = spawnSync('ssh-keygen', [
    '-q',
    '-t',
    'ed25519',
    '-N',
    '',
    '-C',
    `nosana-${job}`,
    '-f',
    privateKeyPath,
  ]);

  if (result.status !== 0) {
    throw new Error('Failed to generate ephemeral SSH key with ssh-keygen');
  }

  return {
    dir,
    privateKeyPath,
    publicKey: fs.readFileSync(`${privateKeyPath}.pub`, 'utf8').trim(),
  };
}

function parseTtlSeconds(ttl: string | number | undefined): number {
  const parsed = Number(ttl ?? SSH_AUTHORIZATION_MAX_TTL_SECONDS);
  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > SSH_AUTHORIZATION_MAX_TTL_SECONDS
  ) {
    throw new Error(
      `SSH authorization ttl must be between 1 and ${SSH_AUTHORIZATION_MAX_TTL_SECONDS} seconds`,
    );
  }
  return parsed;
}

function getSshUserForJob(job: string): string {
  if (!/^[A-Za-z0-9._:-]+$/.test(job)) {
    throw new Error(`Invalid job id for SSH access: ${job}`);
  }
  return `nosana-${job}`;
}

function runInteractiveCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=.,%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
