#!/usr/bin/env node
import { Wallet } from '@coral-xyz/anchor';
import { Client, IPFS } from './';
import type { ClientConfig } from './types';
import { sleep } from './utils';
import { Command, Option } from 'commander';
const program = new Command();

const VERSION = '0.1.0';

/**
 * Shell swag colors for logging
 */
const colors = {
  RED: '\u001b[1;31m',
  GREEN: '\u001b[1;32m',
  BLUE: '\u001b[1;34m',
  CYAN: '\u001b[1;36m',
  WHITE: '\u001b[1;38;5;231m',
  RESET: '\x1b[0m',
};
const escapeCmd = (cmd: string) => cmd.replace(/'/g, "'\"'\"'");
const echoAndRun = (cmd: string) => [
  `echo '${escapeCmd(`${colors.GREEN}$ ${cmd}${colors.RESET}`)}'`,
  cmd,
];

function runThroughShellFile(commands: Array<string>) {
  // eslint-disable-next-line quotes
  return [
    {
      cmd:
        "sh -c '" +
        escapeCmd(
          `echo '${escapeCmd(
            [
              '#!/bin/sh',
              'if set -o | grep pipefail > /dev/null; then set -o pipefail; fi',
              'set -o errexit',
              'set +o noclobber',
            ]
              .concat(commands.map((cmd) => echoAndRun(cmd)).flat())
              .join('\n'),
          )} '`,
        ) +
        " | sh'",
    },
  ];
}

async function run(
  image: string,
  command: string,
  options: {
    [key: string]: any;
  },
) {
  const config: ClientConfig = {
    solana: {
      network: options.network,
    },
  };

  const nosana: Client = new Client(config);
  console.log(
    'Logged in as',
    (nosana.solana.config.wallet as Wallet).publicKey.toString(),
  );
  // if (await nosana.solana.requestAirdrop(1e9)) {
  //   console.log('Received airdrop of 1 SOL!');
  // } else {
  //   console.error('Could not receive airdrop');
  // }

  const json_flow = {
    state: {
      'nosana/job-type': 'github-flow',
    },
    ops: [
      {
        op: 'container/run',
        id: 'run',
        args: {
          cmds: runThroughShellFile([command]),
          image: image,
        },
      },
    ],
  };
  const ipfsHash = await nosana.ipfs.pin(json_flow);
  console.log('ipfs uploaded!', nosana.ipfs.config.gateway + ipfsHash);
  await nosana.jobs.setAccounts();
  nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  const response = await nosana.jobs.list(ipfsHash);
  console.log('job posted!', response);
  let job;
  while (!job || job.state !== 'COMPLETED') {
    console.log('checking job state..', job ? job.state : '');
    try {
      job = await nosana.jobs.get(response.job);
    } catch (e) {
      console.error(e);
    }
    await sleep(5);
  }
  console.log('job done!');
  const result = await nosana.ipfs.retrieve(job.ipfsResult);
  console.log(result);
  if (result.results) {
    console.log(result.results.run);
  }
}

program.name('nosana').description('Nosana ').version(VERSION);
program
  .command('run')
  .description('Create a job to run by Nosana Runners')
  .argument('<image>', 'docker image')
  .argument('<command>', 'command to run')
  .addOption(
    new Option('-n, --network <network>', 'network to run on').default(
      'devnet',
    ),
  )
  .action(run);

async function startCLI() {
  await program.parseAsync(process.argv);
}

startCLI();
