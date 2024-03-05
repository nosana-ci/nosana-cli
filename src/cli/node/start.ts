import { Command } from 'commander';
import { Client, Job, Market, Run } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import chalk from 'chalk';
import ora, { Ora, spinners } from 'ora';
import { sleep, clearLine } from '../../generic/utils.js';
import {
  getRun,
  checkQueued,
  waitForRun,
  NodeStats,
  getNodeStats,
  isRunExpired,
} from '../../services/nodes.js';
import { NotQueuedError } from '../../generic/errors.js';
import { DockerProvider } from '../../providers/DockerProvider.js';
import {
  BaseProvider,
  FlowState,
  JobDefinition,
  validateJobDefinition,
} from '../../providers/BaseProvider.js';
import { PublicKey } from '@solana/web3.js';
import { EMPTY_ADDRESS } from '../../services/jobs.js';
import { IValidation } from 'typia';

let run: Run | void;
let selectedMarket: Market | void;
let spinner: Ora;
let handlingSigInt: Boolean = false;
process.on('SIGINT', async () => {
  if (!handlingSigInt) {
    handlingSigInt = true;
    spinner.stop();
    console.log(chalk.yellow.bold('Shutting down..'));
    const nosana: Client = getSDK();
    if (run) {
      spinner = ora(chalk.cyan('Quiting running job')).start();
      try {
        const tx = await nosana.jobs.quit(run);
        spinner.succeed(`Job successfully quit with tx ${tx}`);
      } catch (e) {
        spinner.fail(chalk.red('Could not quit job'));
        throw e;
      }
    } else if (selectedMarket) {
      spinner = ora(chalk.cyan('Quiting market queue')).start();
      try {
        // @ts-ignore
        const tx = await nosana.jobs.stop(selectedMarket.address);
        spinner.succeed(`Market queue successfully quit with tx ${tx}`);
      } catch (e) {
        spinner.fail(chalk.red('Could not quit market queue'));
        throw e;
      }
    }
    handlingSigInt = false;
    process.exit();
  }
});

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
  run = undefined;
  selectedMarket = undefined;
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
  spinner = ora(chalk.cyan('Checking provider health')).start();
  try {
    await provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  switch (options.provider) {
    case 'docker':
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
  let marketAccount: Market;
  try {
    spinner = ora(chalk.cyan('Retrieving market requirements')).start();
    marketAccount = await nosana.jobs.getMarket(market);
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
  run = await getRun(node);

  if (!run) {
    spinner.text = chalk.cyan('Checking queued status');
    selectedMarket = await checkQueued(node);

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
        spinner = ora(chalk.cyan('Leaving market queue')).start();
        const tx = await nosana.jobs.stop(selectedMarket.address);
      }
      spinner.text = chalk.cyan(`Joining market ${chalk.bold(market)}`);
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
    if (job.market.toString() !== market) {
      console.log(1);
      spinner = ora(chalk.red('Job has the wrong market, quiting job')).start();
      const tx = await nosana.jobs.quit(run);
      run = undefined;
      spinner.info(`Job successfully quit with tx ${tx}`);
    } else if (isRunExpired(run, marketAccount.jobTimeout * 1.5)) {
      // Quit job when timeout * 1.5 is reached.
      spinner = ora(chalk.red('Job is expired, quiting job')).start();
      console.log(3);
      try {
        const tx = await nosana.jobs.quit(run);
        run = undefined;
        spinner.succeed(`Job successfully quit with tx ${tx}`);
      } catch (e) {
        spinner.fail(chalk.red('Could not quit job'));
        throw e;
      }
    } else {
      spinner = ora(chalk.cyan('Retrieving job definition')).start();
      const jobDefinition: JobDefinition = await nosana.ipfs.retrieve(
        job.ipfsJob,
      );

      let result: FlowState;
      const validation: IValidation<JobDefinition> =
        validateJobDefinition(jobDefinition);
      if (!validation.success) {
        spinner.fail('Job Definition validation failed');
        console.error(validation.errors);
        result = {
          id: run.publicKey.toString(),
          startTime: Date.now(),
          endTime: Date.now(),
          ops: [],
          status: 'validation-error',
          errors: validation.errors,
        };
      } else {
        spinner.text = chalk.cyan('Checking provider health');
        if (!(await provider.healthy())) {
          throw new Error('provider not healthy');
          // TODO: wait for provider to get healthy or quit job
        }
        spinner.text = chalk.cyan('Running job');
        const flowId: string = provider.run(
          jobDefinition,
          run.publicKey.toString(),
        );
        result = await new Promise<FlowState>(async function (resolve, reject) {
          // check if expired every minute
          const expireInterval = setInterval(async () => {
            if (isRunExpired(run!, marketAccount.jobExpiration * 1.5)) {
              clearInterval(expireInterval);
              // Quit job when timeout * 1.5 is reached.
              spinner = ora(chalk.red('Job is expired, quiting job')).start();
              try {
                console.log(4);
                const tx = await nosana.jobs.quit(run!);
                spinner.succeed(`Job successfully quit with tx ${tx}`);
                run = undefined;
              } catch (e) {
                spinner.fail(chalk.red('Could not quit job'));
                reject(e);
              }
              // TODO: stop flowId
              reject('Job expired');
            }
          }, 1000 * 60);
          const flowResult = await provider.waitForFlowFinish(flowId);
          clearInterval(expireInterval);
          resolve(flowResult);
        });
      }

      spinner.text = chalk.cyan('Uploading results to IPFS');
      const ipfsResult = await nosana.ipfs.pin(result as object);
      const bytesArray = nosana.ipfs.IpfsHashToByteArray(ipfsResult);
      spinner.text = chalk.cyan('Finishing job');
      const tx = await nosana.jobs.submitResult(
        bytesArray,
        run.publicKey,
        job.market.toString(),
      );
      run = undefined;
      selectedMarket = undefined;
      spinner.succeed(chalk.green('Job finished ') + chalk.green.bold(tx));
    }
  }
  spinner.stop();
  for (let timer = 30; timer > 0; timer--) {
    spinner.start(chalk.cyan(`Starting again in ${timer}`));
    await sleep(1);
  }
  spinner.stop();
  return startNode(market, options, cmd);
}
