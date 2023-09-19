import { Client } from '../';
import { colors } from './terminal.js';
import { getSDK } from './index.js';
import { get } from './get.js';
import util from 'util';
import fs from 'node:fs';
import { randomUUID } from 'crypto';

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
  let json_flow: { [key: string]: any }; // TODO: add JSON flow type
  if (options.file) {
    json_flow = JSON.parse(fs.readFileSync(options.file, 'utf8'));
    json_flow.state['nosana/trigger'] = 'cli';
  } else {
    json_flow = {
      state: {
        'nosana/type': 'docker',
        'nosana/trigger': 'cli',
      },
      ops: [
        {
          op: 'container/run',
          id: 'run-from-cli',
          args: {
            workdir: '/nosana-ci',
            cmds: runThroughShellFile([command.join(' ')]),
            image: options.image,
          },
        },
      ],
    };
    if (options.gpu) {
      json_flow.ops[0].devices = [{ path: 'nvidia.com/gpu=all' }];
    }
  }
  const artifactId = 'artifact-' + randomUUID();
  if (options.output) {
    const volumeId = randomUUID() + '-volume';
    const createVolumeOp = {
      op: 'container/create-volume',
      id: volumeId,
    };
    for (let i = 0; i < json_flow.ops.length; i++) {
      json_flow.ops[i].args.volumes = [
        {
          name: volumeId,
          dest: '/nosana-ci',
        },
      ];
      if (!json_flow.ops[i].args.workdir) {
        json_flow.ops[i].args.workdir = '/nosana-ci';
      }
    }
    json_flow.ops.unshift(createVolumeOp);
    const cmd = `nosana-node-helper artifact-uploader --job-id ${artifactId} --path ${options.output}`;
    json_flow.ops.push({
      op: 'container/run',
      id: artifactId,
      args: {
        image: 'nosana/nosana-node-helper:latest',
        env: {
          SECRETS_MANAGER: nosana.secrets.config.manager,
          SECRETS_TOKEN: ['nosana/secrets-jwt', nosana.secrets.config.manager],
          PINATA_JWT: ['nosana/pinata-jwt'],
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        },
        workdir: '/nosana-ci',
        volumes: [
          {
            name: volumeId,
            dest: '/nosana-ci',
          },
        ],
        cmds: [{ cmd }],
      },
    });
  }

  // if (options.gpu) {

  // }

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
  const market = await nosana.jobs.getMarket(
    nosana.solana.config.market_address,
  );

  console.log(
    `posting job to market ${colors.CYAN}${
      nosana.solana.config.market_address
    }${colors.RESET} for price ${colors.YELLOW}${
      parseInt(market.jobPrice) / 1e6
    } NOS/s${colors.RESET}`,
  );

  await nosana.jobs.setAccounts();
  if (market.jobPrice == 0) {
    nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  }
  const response = await nosana.jobs.list(ipfsHash);
  console.log('job posted!', response);
  await get(response.job, options, undefined, nosana);

  if (!options.completed) {
    console.log(
      `\nrun ${colors.CYAN}nosana get ${response.job}${colors.RESET} to retrieve job and result`,
    );
  }
}
