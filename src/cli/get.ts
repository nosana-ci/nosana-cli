import { Command } from 'commander';
import { Client } from '../';
import { getSDK } from './index.js';
import util from 'util';
import { sleep } from '../utils.js';

/**
 * Shell swag colors for logging
 */
const colors = {
  RED: '\u001b[1;31m',
  GREEN: '\u001b[1;32m',
  BLUE: '\u001b[1;34m',
  CYAN: '\u001b[1;36m',
  WHITE: '\u001b[1;38;5;231m',
  RESET: '\u001b[0m',
};

export async function get(
  jobAddress: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
  nosana?: Client,
) {
  if (!nosana) {
    nosana = getSDK();
  }
  let job;
  while (
    !job ||
    (options.completed && job.state !== 'COMPLETED' && job.state !== 'STOPPED')
  ) {
    console.log('retrieving job...');
    try {
      job = await nosana.jobs.get(jobAddress);
    } catch (e) {
      console.error(e);
    }
    if (job) {
      if (
        !options.completed ||
        job.state === 'COMPLETED' ||
        job.state === 'STOPPED'
      ) {
        if (options.raw) {
          console.log(
            util.inspect(job, { showHidden: false, depth: null, colors: true }),
          );
        } else {
          console.log(
            `Job:\t\t${
              colors.BLUE
            }https://explorer.nosana.io/jobs/${jobAddress}${
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

  if (job.state === 'COMPLETED') {
    const ipfsResult = await nosana.ipfs.retrieve(job.ipfsResult);
    if (options.raw) {
      console.log(
        util.inspect(ipfsResult, {
          showHidden: false,
          depth: null,
          colors: true,
        }),
      );
    } else {
      console.log('Logs:');
      const result = ipfsResult?.results;
      if (result) {
        let commands = [];
        if (result['run-from-cli']) {
          commands.push('run-from-cli');
        } else {
          const jsonFlow = await nosana.ipfs.retrieve(job.ipfsJob);
          if (jsonFlow.ops) {
            commands = jsonFlow.ops.map((j: any) => j.name || j.id);
            const type = jsonFlow.state && jsonFlow.state['nosana/job-type'];
            switch (type) {
              case 'Github':
              case 'github-flow':
                if (!commands.includes('checkout'))
                  commands.unshift('checkout');
                break;
              case 'gitlab':
                break;
            }
          }
        }
        for (let i = 0; i < commands.length; i++) {
          const command = commands[i];
          if (result[command] && !command.endsWith('-volume')) {
            console.log(
              `${colors.GREEN}- Executed step ${command}${colors.RESET}`,
            );
            // const commandStatus = result[command][0];
            const steps = result[command][1];
            if (Array.isArray(steps)) {
              for (let j = 0; j < steps.length; j++) {
                const step = steps[j];
                if (step.cmd) {
                  if (step.cmd.cmd) {
                    if (!step.cmd.cmd.startsWith('sh -c')) {
                      console.log(
                        `${colors.CYAN}$ ${step.cmd.cmd}${colors.RESET}`,
                      );
                    }
                  } else {
                    console.log(`${colors.CYAN}$ ${step.cmd}${colors.RESET}`);
                  }
                }
                if (step.log && Array.isArray(step.log)) {
                  let logString = '';
                  for (let k = 0; k < step.log.length; k++) {
                    const log = step.log[k];
                    const color = log[0] === 2 && step.status ? colors.RED : '';
                    logString += `${color}${log[1]}${colors.RESET}`;
                  }
                  console.log(logString);
                }
                if (step.error) {
                  console.log(`${colors.RED}${step.error}${colors.RESET}`);
                }
                if (step.status) {
                  console.log(
                    `${colors.RED}Exited with code ${step.status}${colors.RESET}`,
                  );
                }
              }
            } else {
              console.log(`${colors.RED}${steps}${colors.RESET}`);
            }
          }
        }
      } else {
        console.log(`${colors.RED}Cannot log results${colors.RESET}`);
      }
    }
  }
}
