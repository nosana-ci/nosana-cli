import { Command } from 'commander';
import { Client, Job, Market, Run } from '@nosana/sdk';
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
import { BaseProvider, JobDefinition } from '../../providers/BaseProvider.js';

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

  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  console.log('================================');
  let provider: BaseProvider;
  switch (options.provider) {
    case 'docker':
    default:
      provider = new DockerProvider(options.podman);
      break;
  }

  /****************
   * Health Check *
   ****************/
  const stats: NodeStats = await getNodeStats(node);
  if (stats.sol < 0.001) throw new Error('not enough SOL');
  try {
    await provider.healthy();
  } catch (error) {
    console.log(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  switch (options.provider) {
    case 'docker':
    default:
      console.log(chalk.green(`Podman is running on ${options.podman}`));
      break;
  }

  // TODO Check stake account
  //      If no stake account: create empty stake account
  // const stake = await nosana.stake.create(
  //   nodeKey,
  //   0,
  //   14,
  // );

  // TODO Check NFT that is needed for market

  /****************
   *   Job Loop   *
   ****************/
  let spinner = ora(chalk.cyan('Checking existing runs')).start();

  // Check if we already have a run account
  let run: Run | void = await getRun(node);

  if (!run) {
    spinner.text = chalk.cyan('Checking queued status');
    let selectedMarket: Market | void = await checkQueued(node);

    if (!selectedMarket || selectedMarket.address.toString() === market) {
      if (selectedMarket) {
        // TODO: We are in the wrong market, leave queue
        throw new Error('Queued in wrong market, please leave market first');
      }
      spinner.text = chalk.cyan('Joining market ');
      const tx = await nosana.jobs.work(market);
      console.log(chalk.greenBright(`Joined market tx ${tx}`));
    }
    if (selectedMarket) {
      // Currently queued in a market, wait for run
      spinner.color = 'yellow';
      const queuedMarketText = (market: Market, node: string) => {
        return (
          chalk.bgYellow.bold(' QUEUED ') +
          ` at position ${
            market.queue.findIndex((e: any) => e.toString() === node) + 1
          }/${market.queue.length} in market ${chalk.cyan.bold(market.address)}`
        );
      };
      spinner.text = queuedMarketText(selectedMarket, node);
      try {
        // will only return on a new run account
        run = await waitForRun(
          node,
          selectedMarket.address,
          // This callback gets called every minute with the updated market
          (market: Market) => {
            selectedMarket = market;
            spinner.text = queuedMarketText(selectedMarket, node);
          },
        );
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
  }
  if (run) {
    if (spinner) spinner.stop();
    const jobAddress = run.account.job.toString();
    console.log(chalk.green('Claimed job ') + chalk.green.bold(jobAddress));
    const job: Job = await nosana.jobs.get(jobAddress);
    if (job.market.toString() !== market) {
      // TODO: stop job
    } else {
      spinner = ora(chalk.cyan('Retrieving job definition')).start();
      // TODO: check job expired
      const jobDefinition: JobDefinition = await nosana.ipfs.retrieve(
        job.ipfsJob,
      );
      spinner.text = chalk.cyan('Checking provider health');
      if (!(await provider.healthy())) {
        throw new Error('provider not healthy');
        // TODO: wait for provider to get healthy
      }
      spinner.text = chalk.cyan('Running job');
      const runId: string = await provider.run(jobDefinition);
      // TODO: retrieve results from runId
      const result = {};
      spinner.text = chalk.cyan('Uploading results to IPFS');
      const ipfsResult = await nosana.ipfs.pin(result);
      const bytesArray = nosana.ipfs.IpfsHashToByteArray(ipfsResult);
      spinner.text = chalk.cyan('Finishing job');
      const tx = await nosana.jobs.submitResult(
        bytesArray,
        run.publicKey,
        job.market.toString(),
      );
      spinner.succeed(chalk.green('Job finished ') + chalk.green.bold(tx));
      for (let timer = 30; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Starting again in ${timer}`));
        await sleep(1);
      }
      spinner.stop();
    }
  }
  return startNode(node, options, cmd);
}
