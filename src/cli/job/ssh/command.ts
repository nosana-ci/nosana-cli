import { Command, Option } from 'commander';

import { sshJob, sshProxy } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

export const sshJobCommand = new Command('ssh')
  .description('Open an SSH shell into a running job')
  .argument('<job>', 'job address')
  .addOption(new Option('--op <op>', 'operation id to connect to'))
  .addOption(
    new Option(
      '--ttl <seconds>',
      'temporary SSH authorization lifetime in seconds',
    ).default('300'),
  )
  .addOption(
    new Option(
      '--proxy-host <host>',
      'FRP TCPMUX HTTP CONNECT proxy host',
    ),
  )
  .addOption(
    new Option(
      '--proxy-port <port>',
      'FRP TCPMUX HTTP CONNECT proxy port',
    ).default('5002'),
  )
  .addOption(new Option('--ssh-command <command>', 'SSH executable').default('ssh'))
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
  .action(sshJob);

export const sshProxyCommand = new Command('ssh-proxy')
  .description('Proxy SSH through the Nosana FRP TCPMUX HTTP CONNECT endpoint')
  .argument('<host>', 'target SSH host')
  .argument('<port>', 'target SSH port')
  .addOption(new Option('--proxy-host <host>', 'proxy host').makeOptionMandatory())
  .addOption(new Option('--proxy-port <port>', 'proxy port').makeOptionMandatory())
  .action(sshProxy);
