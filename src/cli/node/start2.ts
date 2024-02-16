import { Command } from 'commander';
import { Client, Run } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import chalk from 'chalk';
import ora from 'ora';
import { getJob } from '../job/get.js';
import { sleep, clearLine } from '../../generic/utils.js';
import { getRun, checkQueued, waitForRun } from '../../services/nodes.js';
import { NotQueuedError } from '../../generic/errors.js';

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();

  // TODO: Node Health 
  // 1: check balance SOL/NOS
  // 1.1: not enough SOL: show instructions with wallet address and exit

  // 2: Check stake account
  // 2.2: If no stake account: create empty stake account

  // 3: Check NFT that is needed for market

  // 4: Provider check (e.g. is docker/podman api running)

  const spinner = ora(chalk.cyan('Checking node status')).start();

  // Check if we already have a run account
  let run: Run | void = await getRun(node);

  if (!run) {
    const selectedMarket = await checkQueued(node);
    // todo: check queue position

    if (!selectedMarket) {
      spinner.warn("Currently not running a job and not queued in a market")
      for (let timer = 10; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Trying again in ${timer}`));
        await sleep(1);
      }
      spinner.stop();
      clearLine();
    } else {
      // Currently queued in a market, wait for run
      spinner.color = 'yellow';
      spinner.text = chalk.bgYellow.bold(' QUEUED ') + ` waiting for jobs in market ${chalk.cyan.bold(selectedMarket.address)}`;
      try {
        run = await waitForRun(node, true); // will only return on a new run account
      } catch (e) {
        if (e instanceof NotQueuedError) {
          spinner.warn("Node left market queue..")
          for (let timer = 10; timer > 0; timer--) {
            spinner.start(chalk.cyan(`Checking again in ${timer}`));
            await sleep(1);
          }
          spinner.stop();
          clearLine();
        } else {
          throw e;
        }
      }
    }
  }
  if (run) {
    if (spinner) spinner.stop();
    const jobAddress = run.account.job.toString();
    console.log(chalk.green.bold(`Claimed job ${jobAddress}`));
    // TODO: retrieve job account
    // TODO: check if market in job account is same as we want to run in
    // TODO: if different > stop job
    // TODO: else > run job (and regularly keep checking if job expired)
    // TODO: post results and finish job
  }
  return startNode(node, options, cmd);
}
