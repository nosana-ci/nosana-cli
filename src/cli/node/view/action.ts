import chalk from 'chalk';
import { Command } from 'commander';
import { Client, Market, Run } from '@nosana/sdk';
import ora from 'ora';

import { getJob } from '../../job/get/action.js';
import { NotQueuedError } from '../../../generic/errors.js';
import { sleep, clearLine } from '../../../generic/utils.js';
import { getSDK } from '../../../services/sdk.js';

export async function view(
  node: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  const nosana: Client = getSDK();
  const spinner = ora(chalk.cyan('Checking node status')).start();

  // // Check if we already have a run account
  // let run: Run | void = await getRun(node);
  // if (!run) {
  //   let selectedMarket: Market | void = await checkQueued(node);
  //   if (!selectedMarket) {
  //     spinner.warn('Currently not running a job and not queued in a market');
  //     for (let timer = 10; timer > 0; timer--) {
  //       spinner.start(chalk.cyan(`Trying again in ${timer}`));
  //       await sleep(1);
  //     }
  //     spinner.stop();
  //     clearLine();
  //   } else {
  //     // Currently queued in a market, wait for run
  //     spinner.color = 'yellow';
  //     const queuedMarketText = (market: Market, node: string) => {
  //       return (
  //         chalk.bgYellow.bold(' QUEUED ') +
  //         ` at position ${
  //           market.queue.findIndex((e: any) => e.toString() === node) + 1
  //         }/${market.queue.length} in market ${chalk.cyan.bold(market.address)}`
  //       );
  //     };
  //     spinner.text = queuedMarketText(selectedMarket, node);
  //     try {
  //       // will only return on a new run account
  //       run = await waitForRun(
  //         node,
  //         selectedMarket.address,
  //         // This callback gets called every minute with the updated market
  //         (market: Market) => {
  //           selectedMarket = market;
  //           spinner.text = queuedMarketText(selectedMarket, node);
  //         },
  //       );
  //     } catch (e) {
  //       if (e instanceof NotQueuedError) {
  //         spinner.warn('Node left market queue..');
  //         for (let timer = 10; timer > 0; timer--) {
  //           spinner.start(chalk.cyan(`Checking again in ${timer}`));
  //           await sleep(1);
  //         }
  //         spinner.stop();
  //         clearLine();
  //       } else {
  //         throw e;
  //       }
  //     }
  //   }
  // }
  // if (run) {
  //   if (spinner) spinner.stop();
  //   const jobAddress = run.account.job.toString();
  //   console.log(chalk.green.bold('Found claimed job!'));
  //   await getJob(jobAddress, { wait: true, ...options }, undefined);
  // }
  return view(node, options, cmd);
}
