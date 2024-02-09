import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import { getSDK } from '../utils/sdk.js';
import chalk from 'chalk';
import ora from 'ora';
import { getJob } from '../job/get.js';
import type { ClientSubscriptionId, PublicKey } from '@solana/web3.js';
import { sleep } from '../utils.js';
import { clearLine } from '../utils/terminal.js';


export async function view(
  node: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  const nosana: Client = getSDK();

  // TODO: check if in view mode (optional node argument)
  let getRunsInterval: NodeJS.Timer, subscriptionId: ClientSubscriptionId;
  const checkAndStartNodeRun = async (run?: any) => {
    if (!run) {
      const runs = await nosana.jobs.getRuns([
        {
          memcmp: {
            offset: 40,
            bytes: node,
          },
        },
      ]);
      if (runs && runs.length > 0) {
        run = runs[0].account;
      }
    }
    if (run) {
      if (subscriptionId >= 0) nosana.jobs.connection!.removeProgramAccountChangeListener(subscriptionId);
      if (getRunsInterval) clearInterval(getRunsInterval);
      if (spinner) spinner.stop();
      const jobAddress = run.job.toString();
      console.log(chalk.green.bold('Found claimed job!'));
      // TODO: run job instead of get job when not in view mode
      return getJob(jobAddress, { wait: true, ...options }, undefined, nosana);
      // TODO: start over
    }
  }
  const spinner = ora(chalk.cyan('Checking node status')).start();
  // Check if we already have a running job
  const job = await checkAndStartNodeRun();
  if (!job) {
    // TODO 2: fetch all markets to see if in any queue
    // TODO 2.1: if not queued, join market (or wait when in view mode)
    const markets = await nosana.jobs.allMarkets();
    // check all markets and see if the node is in the queue
    let selectedMarket;
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      if (market && market.queue &&
        market.queue.find((e: PublicKey) => e.toString() === node)) {
        selectedMarket = market;
        break;
      }
    }
    if (!selectedMarket) {
      spinner.warn("Currently not running a job and not queued in a market")

      for (let timer = 10; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Trying again in ${timer}`));
        await sleep(1);
      }
      spinner.stop();
      clearLine();
      return view(node, options, cmd);
    }
    spinner.color = 'yellow';
    spinner.text = chalk.bgYellow.bold(' QUEUED ') + ` waiting for jobs in market ${chalk.cyan.bold(selectedMarket.address)}`;
    // As a fallback for the run events, runs every 5 minutes
    getRunsInterval = setInterval(checkAndStartNodeRun, 60000 * 5);


    await nosana.jobs.loadNosanaJobs();
    const jobProgram = nosana.jobs.jobs!;
    const runAccountFilter: { offset: number; bytes: string; } =
      jobProgram.coder.accounts.memcmp(jobProgram.account.runAccount.idlAccount.name, undefined);
    const coderFilters = [{
      memcmp: {
        offset: runAccountFilter.offset,
        bytes: runAccountFilter.bytes
      },
    },
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    }];
    subscriptionId = nosana.jobs.connection!.onProgramAccountChange(
      jobProgram.programId,
      async (event) => {
        nosana.jobs.connection!.removeProgramAccountChangeListener(subscriptionId);
        const runAccount = jobProgram.coder.accounts.decode(jobProgram.account.runAccount.idlAccount.name, event.accountInfo.data);
        await checkAndStartNodeRun(runAccount);
      }, 'confirmed', coderFilters
    );
  }
}
