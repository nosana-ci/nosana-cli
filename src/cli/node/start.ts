import { Command } from 'commander';
import { Client, Job, Market, Run } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
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
  Provider,
  Flow,
  JobDefinition,
  validateJobDefinition,
  FlowState,
} from '../../providers/Provider.js';
import { PublicKey } from '@solana/web3.js';
import { EMPTY_ADDRESS } from '../../services/jobs.js';
import { IValidation } from 'typia';
import { PodmanProvider } from '../../providers/PodmanProvider.js';

let provider: Provider;
let run: Run | void;
let selectedMarket: Market | void;
let spinner: Ora;

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command,
): Promise<void> {
  /*************
   * Bootstrap *
   *************/

  let handlingSigInt: Boolean = false;
  process.on('SIGINT', async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      if (spinner) {
        spinner.stop();
      }
      console.log(chalk.yellow.bold('Shutting down..'));
      const nosana: Client = getSDK();
      if (run) {
        spinner = ora(chalk.cyan('Quiting running job')).start();
        try {
          const tx = await nosana.jobs.quit(run);
          spinner.succeed(`Job successfully quit with tx ${tx}`);
        } catch (e) {
          spinner.fail(chalk.red.bold('Could not quit job'));
          throw e;
        }
        await provider.clearFlow(run.publicKey.toString());
      } else if (selectedMarket) {
        spinner = ora(chalk.cyan('Leaving market queue')).start();
        try {
          const tx = await nosana.jobs.stop(selectedMarket.address);
          spinner.succeed(`Market queue successfully left with tx ${tx}`);
        } catch (e) {
          spinner.fail(chalk.red.bold('Could not quit market queue'));
          throw e;
        }
      }
      handlingSigInt = false;
      process.exit();
    }
  });

  run = undefined;
  selectedMarket = undefined;
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();

  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  switch (options.provider) {
    case 'podman':
      provider = new PodmanProvider(options.podman);
      break;
    case 'docker':
    default:
      provider = new DockerProvider(options.podman);
      break;
  }
  let marketAccount: Market;
  let nft: PublicKey | undefined;
  try {
    spinner = ora(chalk.cyan('Retrieving market')).start();
    marketAccount = await nosana.jobs.getMarket(market);
    spinner.stop();
    console.log(`Market:\t\t${chalk.greenBright.bold(market)}`);
    console.log('================================');
  } catch (e: any) {
    spinner.fail(chalk.red(`Could not retrieve market ${chalk.bold(market)}`));
    if (e.message && e.message.includes('Account does not exist')) {
      throw new Error(chalk.red(`Market ${chalk.bold(market)} not found`));
    }
    throw e;
  }
  /****************
   * Health Check *
   ****************/
  const healthCheck = async () => {
    spinner = ora(chalk.cyan('Checking SOL balance')).start();
    try {
      const stats: NodeStats = await getNodeStats(node);
      if (stats.sol / 1e9 < 0.001) {
        spinner.fail(chalk.red.bold('Not enough SOL balance'));
        throw new Error(
          `SOL balance ${stats.sol / 1e9} should be 0.001 or higher`,
        );
      }
      spinner.succeed(
        chalk.green(`Sol balance: ${chalk.bold(stats.sol / 1e9)}`),
      );
    } catch (e) {
      spinner.warn(
        'Could not check SOL balance, make sure you have enough SOL',
      );
    }

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
    try {
      if (marketAccount.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()) {
        spinner.succeed(chalk.green(`Open market ${chalk.bold(market)}`));
      } else {
        spinner.text = chalk.cyan(
          `Checking required access key for market ${chalk.bold(market)}`,
        );
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
          throw new Error('Could not find access key');
        }
      }
    } catch (e: any) {
      spinner.fail(chalk.red(`Denied access to market ${chalk.bold(market)}`));
      throw e;
    }
  };
  await healthCheck();
  /****************
   *   Job Loop   *
   ****************/
  const jobLoop = async (firstRun: Boolean = false): Promise<void> => {
    try {
      if (!firstRun) {
        await healthCheck();
      }
      spinner = ora(chalk.cyan('Checking existing runs')).start();

      // Check if we already have a run account
      run = await getRun(node);

      if (!run) {
        spinner.text = chalk.cyan('Checking queued status');
        selectedMarket = await checkQueued(node);

        if (!selectedMarket || selectedMarket.address.toString() !== market) {
          if (selectedMarket) {
            // We are in the wrong market, leave queue
            spinner.fail(
              chalk.red(
                `Queued in wrong market ${chalk.bold(
                  selectedMarket.address.toString(),
                )}`,
              ),
            );
            spinner = ora(chalk.cyan('Leaving market queue')).start();
            try {
              const tx = await nosana.jobs.stop(selectedMarket.address);
              spinner.succeed(`Market queue successfully left with tx ${tx}`);
            } catch (e) {
              spinner.fail(chalk.red('Could not quit market queue'));
              throw e;
            }
            spinner = ora().start();
          }
          spinner.text = chalk.cyan(`Joining market ${chalk.bold(market)}`);
          try {
            const tx = await nosana.jobs.work(market, nft ? nft : undefined);
            spinner.succeed(chalk.greenBright(`Joined market tx ${tx}`));
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not join market'));
            throw e;
          }
          try {
            spinner = ora(chalk.cyan('Checking queued status')).start();
            await sleep(2);
            selectedMarket = await checkQueued(node);
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not check market queue'));
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
              }/${market.queue.length} in market ${chalk.cyan.bold(
                market.address,
              )}`
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
          spinner = ora(
            chalk.red('Job has the wrong market, quiting job'),
          ).start();
          try {
            const tx = await nosana.jobs.quit(run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await provider.clearFlow(run.publicKey.toString());
          run = undefined;
        } else if (isRunExpired(run, marketAccount.jobTimeout * 1.5)) {
          // Quit job when timeout * 1.5 is reached.
          spinner = ora(chalk.red('Job is expired, quiting job')).start();
          console.log(3);
          try {
            const tx = await nosana.jobs.quit(run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await provider.clearFlow(run.publicKey.toString());
          run = undefined;
        } else {
          spinner = ora(chalk.cyan('Checking provider health')).start();
          try {
            await provider.healthy();
          } catch (error) {
            spinner.fail(
              chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
            );
            throw error;
          }

          let flowId = run.publicKey.toString();
          let result: Partial<FlowState> | undefined;
          const existingFlow = provider.getFlow(flowId);
          if (!existingFlow) {
            spinner.text = chalk.cyan('Retrieving job definition');
            const jobDefinition: JobDefinition = await nosana.ipfs.retrieve(
              job.ipfsJob,
            );
            const validation: IValidation<JobDefinition> =
              validateJobDefinition(jobDefinition);
            if (!validation.success) {
              spinner.fail(chalk.red.bold('Job Definition validation failed'));
              console.error(validation.errors);
              result = {
                status: 'validation-error',
                errors: validation.errors,
              };
            } else {
              // Create new flow
              flowId = provider.run(jobDefinition, flowId).id;
            }
          } else {
            provider.continueFlow(flowId);
          }

          if (!result) {
            console.log('Running job');
            spinner.text = chalk.cyan('Running job');
            // TODO: move to node service (e.g. waitForResult)?
            result = await new Promise<FlowState>(async function (
              resolve,
              reject,
            ) {
              // check if expired every minute
              const expireInterval = setInterval(async () => {
                if (isRunExpired(run!, marketAccount.jobExpiration * 1.5)) {
                  clearInterval(expireInterval);
                  // Quit job when timeout * 1.5 is reached.
                  spinner = ora(
                    chalk.red('Job is expired, quiting job'),
                  ).start();
                  try {
                    console.log(4);
                    const tx = await nosana.jobs.quit(run!);
                    spinner.succeed(`Job successfully quit with tx ${tx}`);
                    run = undefined;
                  } catch (e) {
                    spinner.fail(chalk.red.bold('Could not quit job'));
                    reject(e);
                  }
                  await provider.clearFlow(flowId);
                  reject('Job expired');
                }
              }, 1000 * 60);
              const flowResult = await provider.waitForFlowFinish(flowId);
              clearInterval(expireInterval);
              resolve(flowResult);
            });
            spinner.succeed('Retrieved results');
          }

          spinner = ora(chalk.cyan('Uploading results to IPFS')).start();
          let ipfsResult: string;
          try {
            ipfsResult = await nosana.ipfs.pin(result as object);
            spinner.succeed(`Uploaded results to IPFS ${ipfsResult}`);
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not upload results to IPFS'));
            throw e;
          }
          const bytesArray = nosana.ipfs.IpfsHashToByteArray(ipfsResult);
          spinner = ora(chalk.cyan('Finishing job')).start();
          try {
            const tx = await nosana.jobs.submitResult(
              bytesArray,
              run.publicKey,
              job.market.toString(),
            );
            run = undefined;
            selectedMarket = undefined;
            spinner.succeed(
              chalk.green('Job finished ') + chalk.green.bold(tx),
            );
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not finish job'));
            throw e;
          }
        }
      }
      spinner.stop();
      for (let timer = 10; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Restarting in ${timer}s`));
        await sleep(1);
      }
      spinner.stop();
    } catch (e: any) {
      spinner.stop();
      const logLevel = cmd.optsWithGlobals().log;
      if (logLevel === 'debug') {
        console.error(e.message ? e.message : e);
      } else if (logLevel === 'trace') {
        console.error(e);
      }

      for (let timer = 30; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Retrying in ${timer}s`));
        await sleep(1);
      }
      spinner.stop();
    }
    jobLoop(false);
  };
  jobLoop(true);
}
