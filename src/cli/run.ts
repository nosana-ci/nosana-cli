import { Client } from '../';
import { sleep } from '../utils.js';
import { colors } from './terminal.js';
import { getSDK } from './index.js';
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
    console.error('warning: [command] ignored as file flag is already set');
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
          id: 'run',
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
  let job;
  while (
    !job ||
    (options.finish && job.state !== 'COMPLETED' && job.state !== 'STOPPED')
  ) {
    console.log('retrieving job..');
    try {
      job = await nosana.jobs.get(response.job);
    } catch (e) {
      console.error(e);
    }
    if (job) {
      if (
        !options.finish ||
        job.state === 'COMPLETED' ||
        job.state === 'STOPPED'
      ) {
        if (options.raw) {
          console.log(
            util.inspect(job, { showHidden: false, depth: null, colors: true }),
          );
        } else {
          console.log(
            `Job:\t\t${colors.BLUE}https://explorer.nosana.io/jobs/${
              response.job
            }${
              nosana.solana.config.network.includes('devnet')
                ? '?network=devnet'
                : ''
            }${colors.RESET}`,
          );
          console.log(
            `JSON flow:\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsJob}${colors.RESET}`,
          );
          console.log(
            `Result:\t\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsResult}${colors.RESET}`,
          );
          console.log(
            `Node:\t\t${colors.BLUE}https://explorer.nosana.io/nodes/${
              job.node
            }${
              nosana.solana.config.network.includes('devnet')
                ? '?network=devnet'
                : ''
            }${colors.RESET}`,
          );
          console.log(
            `Market:\t\t${colors.BLUE}https://explorer.nosana.io/markets/${
              job.market
            }${
              nosana.solana.config.network.includes('devnet')
                ? '?network=devnet'
                : ''
            }${colors.RESET}`,
          );
          console.log(
            `Price:\t\t${colors.CYAN}${job.price} NOS/s${colors.RESET}`,
          );
          if (job.timeStart) {
            console.log(
              `Start Time:\t${colors.CYAN}${new Date(job.timeStart * 1000)}${
                colors.RESET
              }`,
            );
          }
          if (job.timeEnd) {
            console.log(
              `Duration:\t${colors.CYAN}${job.timeEnd - job.timeStart} s${
                colors.RESET
              }`,
            );
          }
          console.log(
            `Status:\t\t${
              job.state === 'COMPLETED' ? colors.GREEN : colors.CYAN
            }${job.state}${colors.RESET}`,
          );
        }
      } else {
        console.log(
          `${job.state === 'COMPLETED' ? colors.GREEN : colors.CYAN}${
            job.state
          }${colors.RESET}`,
        );
        await sleep(5);
      }
    } else {
      await sleep(1);
    }
  }
  if (options.finish) {
    const result = await nosana.ipfs.retrieve(job.ipfsResult);
    if (options.raw) {
      console.log(
        util.inspect(result, { showHidden: false, depth: null, colors: true }),
      );
    } else {
      if (result.results) {
        if (result.results.run) {
          console.log('Logs:');
          const logs = result.results.run[1][1].log;
          let logString = '';
          for (let i = 0; i < logs.length; i++) {
            logString += logs[i][1];
          }
          console.log(logString);
        }
      }
    }
  } else {
    console.log(
      `\nrun ${colors.CYAN}\`nosana get ${response.job}\`${colors.RESET} to retrieve job and result`,
    );
  }
}
