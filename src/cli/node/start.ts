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
import { ContainerProvider } from '../../providers/ContainerProvider.js';
import { BaseProvider, JobDefinition } from '../../providers/BaseProvider.js';
import { PublicKey } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { EMPTY_ADDRESS } from '../../services/jobs.js';

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
    case 'container':
    default:
      provider = new ContainerProvider(options.podman);
      break;
  }
  /****************
   * Health Check *
   ****************/
  const stats: NodeStats = await getNodeStats(node);
  if (stats.sol < 0.001) throw new Error('not enough SOL');
  let spinner = ora(chalk.cyan('Checking provider health')).start();
  try {
    await provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  switch (options.provider) {
    case 'container':
    default:
      spinner.succeed(
        chalk.green(`Podman is running on ${chalk.bold(options.podman)}`),
      );
      break;
  }
  let stake;
  try {
    spinner = ora(chalk.cyan('Checking stake account')).start();
    stake = await nosana.stake.get(node);
  } catch (error: any) {
    if (error.message && error.message.includes('Account does not exist')) {
      spinner.text = chalk.cyan('Creating stake account');
      // If no stake account: create empty stake account
      await nosana.stake.create(new PublicKey(node), 0, 14);
      await sleep(2);
      stake = await nosana.stake.get(node);
    } else {
      throw error;
    }
  }
  spinner.succeed(
    chalk.green(
      `Stake found with ${chalk.bold(stake.amount / 1e6)} NOS staked`,
    ),
  );
  let nft;
  try {
    spinner = ora(chalk.cyan('Retrieving market requirements')).start();
    const marketAccount = await nosana.jobs.getMarket(market);
    if (marketAccount.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()) {
      spinner.succeed(chalk.green(`Open market ${chalk.bold(market)}`));
    } else {
      spinner.text = chalk.cyan('Checking required access key');
      nft = await nosana.solana.getNftFromCollection(
        node,
        marketAccount.nodeAccessKey.toString(),
      );
      if (nft) {
        spinner.succeed(
          chalk.green(
            `Found access key ${chalk.bold(nft)} for market ${chalk.bold(
              market,
            )}`,
          ),
        );
      } else {
        throw new Error(
          chalk.red(
            `Could not find access key for market ${chalk.bold(market)}`,
          ),
        );
      }
    }
  } catch (e: any) {
    spinner.fail();
    if (e.message && e.message.includes('Account does not exist')) {
      throw new Error(chalk.red(`Market ${chalk.bold(market)} not found`));
    }
    throw e;
  }

  // TODO Check NFT that is needed for market

  /****************
   *   Job Loop   *
   ****************/
  spinner = ora(chalk.cyan('Checking existing runs')).start();

  // Check if we already have a run account
  let run: Run | void = await getRun(node);

  if (!run) {
    spinner.text = chalk.cyan('Checking queued status');
    let selectedMarket: Market | void = await checkQueued(node);

    if (!selectedMarket || selectedMarket.address.toString() !== market) {
      if (selectedMarket) {
        // TODO: We are in the wrong market, leave queue
        spinner.fail(
          chalk.red(
            `Queued in wrong market ${chalk.bold(
              selectedMarket.address.toString(),
            )}`,
          ),
        );
        throw new Error('TODO: leave market');
      }
      spinner.text = chalk.cyan('Joining market ');
      try {
        const tx = await nosana.jobs.work(market, nft ? nft : undefined);
        spinner.succeed(chalk.greenBright(`Joined market tx ${tx}`));
        spinner = ora(chalk.cyan('Checking queued status')).start();
        await sleep(2);
        selectedMarket = await checkQueued(node);
      } catch (e) {
        spinner.fail(chalk.red.bold('Could not join market'));
        throw e;
      }
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
    if (job.market.toString() === market) {
      throw new Error('TODO: stop job, wrong market');
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
      const flowId: string = provider.run(jobDefinition);
      const flowResult = await provider.waitForFlowFinish(flowId);
      const result = flowResult;
      spinner.text = chalk.cyan('Uploading results to IPFS');
      const ipfsResult = await nosana.ipfs.pin(result as object);
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
  return startNode(market, options, cmd);
}
