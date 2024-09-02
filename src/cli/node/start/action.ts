import chalk from 'chalk';
import { Command } from 'commander';
import { Client, Job, Market } from '@nosana/sdk';
import ora, { type Ora } from 'ora';
import { PublicKey } from '@solana/web3.js';
import 'rpc-websockets/dist/lib/client.js';
import { sleep, clearLine } from '../../../generic/utils.js';
import { NotQueuedError } from '../../../generic/errors.js';
import {
  JobDefinition,
  FlowState,
  ProviderEvents,
} from '../../../providers/Provider.js';
import { getSDK } from '../../../services/sdk.js';
import { NosanaNode } from '../../../services/NosanaNode.js';
import { validateCLIVersion } from '../../../services/versions.js';

let node: NosanaNode;
let spinner: Ora;

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command,
): Promise<void> {
  /*************
   * Shutdown  *
   *************/
  let handlingSigInt: Boolean = false;
  const onShutdown = async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      if (spinner) {
        spinner.stop();
      }
      console.log(chalk.yellow.bold('Shutting down..'));
      if (node) {
        try {
          await node.shutdown();
        } catch (e: any) {
          const logLevel = cmd.optsWithGlobals().log;
          if (logLevel === 'debug') {
            console.error(e.message ? e.message : e);
          } else if (logLevel === 'trace') {
            console.error(e);
          }
        }
      }
      handlingSigInt = false;
      process.exit();
    }
  };
  process.on('SIGINT', onShutdown);
  process.on('SIGTERM', onShutdown);

  /****************
   * Nosana Node  *
   ****************/
  const sdk: Client = getSDK();
  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  node = new NosanaNode(sdk, options.provider, options.podman, options.config);

  node.logger.override(
    ProviderEvents.INFO_LOG,
    (event: { log: string; type: string; pending: boolean }) => {
      if (!handlingSigInt) {
        node.logger.standard_info_log(event, spinner);
      }
    },
  );
  try {
    await node.provider.healthy();
  } catch (error) {
    console.log(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  spinner = ora(chalk.cyan('Starting API')).start();
  try {
    await node.startAPI();
  } catch (error) {
    spinner.fail(chalk.red(`Could not start API`));
    throw error;
  }

  /****************
   *    Market    *
   ****************/
  let accessKey: PublicKey | undefined;
  if (!market) {
    // If we don't specify a market, try to join test grid
    ({ market, accessKey } = await node.joinTestGrid());
  }

  // TODO: decouple resources in providers from markets/blockchain/backend stuff,
  //       that should be part of the node or cli..
  // await node.provider.updateMarketRequiredResources(market);

  let marketAccount: Market;
  try {
    spinner = ora(chalk.cyan('Retrieving market')).start();
    marketAccount = await node.sdk.jobs.getMarket(market);
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
  const healthCheck = await node.healthCheck({
    market,
    marketAccount,
    accessKey,
  });
  // The health check either grabs the accessKey from on-chain. If no accessKey is found on-chain,
  // we'll try with the access key we got from the backend for test-grid
  accessKey = healthCheck.accessKey;

  let firstRun: Boolean = true;

  /****************
   *   Job Loop   *
   ****************/
  const jobLoop = async (): Promise<void> => {
    try {
      if (firstRun) {
        firstRun = false;
      } else {
        await validateCLIVersion();
        const healthCheck = await node.healthCheck({
          market,
          marketAccount,
          accessKey,
          printDetailed: false,
        });
        accessKey = healthCheck.accessKey;
      }
      spinner = ora(chalk.cyan('Checking existing runs')).start();

      // Check if we already have a run account
      await node.checkRun();

      if (!node.run) {
        spinner.text = chalk.cyan('Checking queued status');
        await node.checkQueued();

        if (!node.market || node.market.address.toString() !== market) {
          if (node.market) {
            // We are in the wrong market, leave queue
            spinner.fail(
              chalk.red(
                `Queued in wrong market ${chalk.bold(
                  node.market.address.toString(),
                )}`,
              ),
            );
            spinner = ora(chalk.cyan('Leaving market queue')).start();
            try {
              const tx = await node.sdk.jobs.stop(node.market.address);
              spinner.succeed(`Market queue successfully left with tx ${tx}`);
            } catch (e) {
              spinner.fail(chalk.red('Could not quit market queue'));
              throw e;
            }
            spinner = ora().start();
          }
          spinner.text = chalk.cyan(`Joining market ${chalk.bold(market)}`);
          try {
            const tx = await node.sdk.jobs.work(
              market,
              accessKey ? accessKey : undefined,
            );
            spinner.succeed(chalk.greenBright(`Joined market tx ${tx}`));
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not join market'));
            throw e;
          }
          try {
            spinner = ora(chalk.cyan('Checking queued status')).start();
            await sleep(2);
            await node.checkQueued();
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not check market queue'));
            throw e;
          }
        }
        if (node.market) {
          // Currently queued in a market, wait for run
          spinner.color = 'yellow';
          const queuedMarketText = (market: Market, nodeAddress: string) => {
            return (
              chalk.bgYellow.bold(' QUEUED ') +
              ` at position ${
                market.queue.findIndex(
                  (e: any) => e.toString() === nodeAddress,
                ) + 1
              }/${market.queue.length} in market ${chalk.cyan.bold(
                market.address,
              )}`
            );
          };
          spinner.text = queuedMarketText(node.market, node.address);
          try {
            // will only return on a new run account
            await node.waitForRun(
              node.market.address,
              // This callback gets called every minute with the updated market
              (market: Market) => {
                spinner.text = queuedMarketText(market, node.address);
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
        } else {
          // We joined the market, but we are not queued, check for a run account
          await node.checkRun();
        }
      }
      if (node.run) {
        if (spinner) spinner.stop();
        const jobAddress = node.run.account.job.toString();
        console.log(chalk.green('Claimed job ') + chalk.green.bold(jobAddress));
        const job: Job = await node.sdk.jobs.get(jobAddress);
        if (job.market.toString() !== market) {
          spinner = ora(
            chalk.red('Job has the wrong market, quiting job'),
          ).start();
          try {
            const tx = await node.sdk.jobs.quit(node.run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await node.provider.stopFlow(node.run.publicKey.toString());
          node.run = undefined;
        } else if (
          NosanaNode.isRunExpired(
            node.run,
            (marketAccount?.jobTimeout as number) * 1.5,
          ) &&
          1 + 1 === 3
        ) {
          // Quit job when timeout * 1.5 is reached.
          spinner = ora(chalk.red('Job is expired, quiting job')).start();
          try {
            const tx = await node.sdk.jobs.quit(node.run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await node.provider.stopFlow(node.run.publicKey.toString());
          node.run = undefined;
        } else {
          spinner = ora(chalk.cyan('Checking provider health')).start();
          try {
            await node.provider.healthy();
          } catch (error) {
            spinner.fail(
              chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
            );
            throw error;
          }
          let flowId = jobAddress;
          let result: Partial<FlowState> | null = null;
          const existingFlow = node.provider.getFlow(flowId);
          if (!existingFlow) {
            spinner.text = chalk.cyan('Retrieving job definition');
            const jobDefinition: JobDefinition = await node.sdk.ipfs.retrieve(
              job.ipfsJob,
            );
            spinner.succeed(chalk.green('Retrieved job definition'));
            // Create new flow
            flowId = node.provider.run(jobDefinition, flowId).id;
          } else {
            spinner.info(chalk.cyan('Continuing with existing flow'));
            node.provider.continueFlow(flowId);
          }

          if (!result) {
            result = await node.waitForJob();
            if (result) {
              spinner.succeed(`Retrieved results with status ${result.status}`);
            }
          }
          if (result) {
            node.finishJob(job, node.run.publicKey, result);
            if (result.status !== 'success') {
              // Flow failed, so we have a cooldown of 15 minutes
              console.log(chalk.cyan('Waiting to enter the queue'));
              await sleep(900);
            }
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

      for (let timer = 60; timer > 0; timer--) {
        spinner.start(chalk.cyan(`Retrying in ${timer}s`));
        await sleep(1);
      }
      spinner.stop();
    }
    // Call jobLoop recursively
    jobLoop();
  };
  // First call to initiate jobLoop
  jobLoop();
}
