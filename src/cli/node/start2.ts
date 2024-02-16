import { Command } from 'commander';
import { Client, Run } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import chalk from 'chalk';
import ora from 'ora';
import { sleep, clearLine } from '../../generic/utils.js';
import {
  getRun,
  checkQueued,
  waitForRun,
  NodeStats,
  getNodeStats,
} from '../../services/nodes.js';
import { NotQueuedError } from '../../generic/errors.js';
import { DockerProvider } from '../../providers/DockerProvider.js';

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  /*************
   * Bootstrap *
   *************/
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();

  let provider;
  switch (options.provider) {
    case 'docker':
    default:
      provider = new DockerProvider(options.host, options.port);
      break;
  }

  /****************
   * Health Check *
   ****************/
  const stats: NodeStats = await getNodeStats(node);
  if (stats.sol < 0.001) throw new Error('not enough SOL');
  if (!(await provider.healthy())) throw new Error('Provider not healthy');
  // TODO Check stake account
  //      If no stake account: create empty stake account

  // TODO Check NFT that is needed for market

  const spinner = ora(chalk.cyan('Checking existing runs')).start();

  // Check if we already have a run account
  let run: Run | void = await getRun(node);

  if (!run) {
    spinner.text = chalk.cyan('Checking queued status');
    const selectedMarket = await checkQueued(node);
    // TODO: check queue position

    if (!selectedMarket || selectedMarket.address.toString() === market) {
      if (selectedMarket) {
        // TODO: We are in the wrong market, leave queue
      }
      spinner.text = chalk.cyan('Joining market');
      // TODO: join market queue
    }
    // Currently queued in a market, wait for run
    spinner.color = 'yellow';
    spinner.text =
      chalk.bgYellow.bold(' QUEUED ') +
      ` waiting for jobs in market ${chalk.cyan.bold(market)}`;
    try {
      run = await waitForRun(node, true); // will only return on a new run account
    } catch (e) {
      if (e instanceof NotQueuedError) {
        spinner.warn('Node left market queue..');
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
  // return startNode(node, options, cmd);
}
