import { Command, Option } from 'commander';

import { sshJob, sshProxy } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

function runSshCommand(
  jobOrHost: string,
  port: string | undefined,
  options: Parameters<typeof sshJob>[1],
  command: Command,
): Promise<void> {
  if (options.proxyStdio) {
    if (!port) {
      throw new Error('Missing target SSH port for proxy mode');
    }
    if (!options.proxyHost) {
      throw new Error('Missing FRP proxy host for proxy mode');
    }
    return sshProxy(jobOrHost, port, {
      proxyHost: options.proxyHost,
      proxyPort: options.proxyPort as string | number,
    });
  }

  return sshJob(jobOrHost, options, command);
}

export const sshJobCommand = new Command('ssh')
  .description('Open an SSH shell into a running job')
  .argument('<job>', 'job address')
  .argument('[port]', 'target SSH port for internal proxy mode')
  .addOption(new Option('--op <op>', 'operation id to connect to'))
  .addOption(
    new Option(
      '--ttl <seconds>',
      'temporary SSH authorization lifetime in seconds',
    ).default('300'),
  )
  .addOption(
    new Option('--proxy-host <host>', 'FRP TCPMUX HTTP CONNECT proxy host'),
  )
  .addOption(
    new Option(
      '--proxy-port <port>',
      'FRP TCPMUX HTTP CONNECT proxy port',
    ).default('5002'),
  )
  .addOption(
    new Option('--proxy-stdio', 'internal mode used by OpenSSH ProxyCommand'),
  )
  .addOption(
    new Option('--ssh-command <command>', 'SSH executable').default('ssh'),
  )
  .addOption(new Option('--node-url <url>', 'override node API URL'))
  .addOption(
    new Option(
      '--insecure-skip-host-key-check',
      'disable OpenSSH host key checking for this connection',
    ),
  )
  .addOption(networkOption)
  .addOption(walletOption)
  .addOption(rpcOption)
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(runSshCommand);
