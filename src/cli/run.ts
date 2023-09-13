import { Client } from '../';
import { colors } from './terminal.js';
import { getSDK } from './index.js';
import { get } from './get.js';
import util from 'util';
import fs from 'node:fs';

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

export async function run(
  command: Array<string>,
  options: {
    [key: string]: any;
  },
) {
  if (command.length && options.file) {
    console.error(
      `${colors.YELLOW}WARNING: [command] ignored as file flag is already set${colors.RESET}`,
    );
  } else if (!command.length && !options.file) {
    throw new Error(
      'error: either specify a [command] or provide a file with the --file flag',
    );
  }
  const nosana: Client = getSDK();
  let json_flow;
  if (options.file) {
    json_flow = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  } else {
    json_flow = {
      state: {
        'nosana/job-type': 'github-flow',
      },
      ops: [
        {
          op: 'container/run',
          id: 'run-from-cli',
          args: {
            cmds: runThroughShellFile([command.join(' ')]),
            image: options.image,
          },
        },
      ],
    };
  }

  if (options.raw) {
    console.log(
      util.inspect(json_flow, { showHidden: false, depth: null, colors: true }),
    );
  }
  const ipfsHash = await nosana.ipfs.pin(json_flow);
  console.log(
    `ipfs uploaded:\t${colors.BLUE}${nosana.ipfs.config.gateway + ipfsHash}${
      colors.RESET
    }`,
  );
  await nosana.jobs.setAccounts();
  nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  const response = await nosana.jobs.list(ipfsHash);
  console.log('job posted!', response);
  await get(response.job, options, undefined, nosana);

  if (!options.completed) {
    console.log(
      `\nrun ${colors.CYAN}\`nosana get ${response.job}\`${colors.RESET} to retrieve job and result`,
    );
  }
}
