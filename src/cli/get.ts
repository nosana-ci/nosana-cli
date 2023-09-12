import { Client } from '../';
import { getSDK } from './index.js';
import util from 'util';
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
) {
  const nosana: Client = getSDK();
  const job = await nosana.jobs.get(jobAddress);
  if (options.raw) {
    console.log(
      util.inspect(job, { showHidden: false, depth: null, colors: true }),
    );
  } else {
    console.log(
      `Job:\t\t${colors.BLUE}https://explorer.nosana.io/jobs/${jobAddress}${
        nosana.solana.config.network.includes('devnet') ? '?network=devnet' : ''
      }${colors.RESET}`,
    );
    console.log(
      `JSON flow:\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsJob}${colors.RESET}`,
    );
    console.log(
      `Result:\t\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsResult}${colors.RESET}`,
    );
    console.log(
      `Node:\t\t${colors.BLUE}https://explorer.nosana.io/nodes/${job.node}${
        nosana.solana.config.network.includes('devnet') ? '?network=devnet' : ''
      }${colors.RESET}`,
    );
    console.log(
      `Market:\t\t${colors.BLUE}https://explorer.nosana.io/markets/${
        job.market
      }${
        nosana.solana.config.network.includes('devnet') ? '?network=devnet' : ''
      }${colors.RESET}`,
    );
    console.log(`Price:\t\t${colors.CYAN}${job.price} NOS/s${colors.RESET}`);
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
      `Status:\t\t${job.state === 'COMPLETED' ? colors.GREEN : colors.CYAN}${
        job.state
      }${colors.RESET}`,
    );
  }
  if (job.state === 'COMPLETED') {
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
  }
}
