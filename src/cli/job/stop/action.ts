import ora from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import 'rpc-websockets/dist/lib/client.js';

import { clearLine } from '../../../generic/utils.js';
import { getSDK } from '../../../services/sdk.js';
import { waitForJobRunOrCompletion } from '../../../services/jobs.js';
import { OUTPUT_EVENTS } from '../../../providers/utils/ouput-formatter/outputEvents.js';
import { outputFormatSelector } from '../../../providers/utils/ouput-formatter/outputFormatSelector.js';

import { postStopJobServiceURLWithRetry } from '../../../services/JobManager/actions/stop/postStopJobServiceURLWithRetry.js';

export async function stopJob(
  jobAddress: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
): Promise<void> {
  const nosana: Client = getSDK();
  const formatter = outputFormatSelector(options.format);

  let job;
  console.log('retrieving job...');
  try {
    job = await nosana.jobs.get(jobAddress);
    clearLine();
  } catch (e) {
    clearLine();
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND, { error: e as Error });
  }

  if (job) {
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_URL, {
      job_url: `https://explorer.nosana.io/jobs/${jobAddress}${
        nosana.solana.config.network.includes('devnet') ? '?network=devnet' : ''
      }`,
    });

    formatter.output(OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL, {
      json_flow_url: `${nosana.ipfs.config.gateway}${job.ipfsJob}`,
    });
    formatter.output(OUTPUT_EVENTS.OUTPUT_MARKET_URL, {
      market_url: `https://explorer.nosana.io/markets/${job.market}${
        nosana.solana.config.network.includes('devnet') ? '?network=devnet' : ''
      }`,
    });

    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_PRICE, {
      price: `${job.price / 1e6}`,
    });
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, {
      status: `${job.state}`,
    });

    if (job.state !== 'COMPLETED' && job.state !== 'STOPPED') {
      const spinner = ora(chalk.cyan(`removing job from queue`)).start();

      // use new function to stop job that are still enqueue
      nosana.jobs.delist(jobAddress);

      spinner.succeed();

      formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, {
        status: job.state.toString(),
      });

      if (job.state === 'RUNNING') {
        const spinner = ora(chalk.cyan(`stopping job ${jobAddress}`)).start();

        // use new function to stop job that are stillrunning
        nosana.jobs.end(jobAddress);

        spinner.succeed();
      }
    } else {
      clearLine();
      formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, {
        status: job.state.toString(),
      });
    }
  } else {
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND, {
      error: new Error('Job Not Found'),
    });
  }
}
