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
import { dispatch as nodeDispatch } from '../../../services/state/node/dispatch.js';
import { dispatch as jobDispatch } from '../../../services/state/job/dispatch.js';
import { NODE_STATE_NAME } from '../../../services/state/node/types.js';
import { JOB_STATE_NAME } from '../../../services/state/job/types.js';
import NodeManager from '../../../services/NodeManager/index.js';

let node: NosanaNode;
let spinner: Ora;

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
): Promise<void> {
  const nodeManager = new NodeManager(options);

  while (true) {
    try {
      await nodeManager.init();
      await nodeManager.start(market);
    } catch (error: any) {
      const formattedError = `
      ========== ERROR ==========
      Timestamp: ${new Date().toISOString()}
      Error Name: ${error.name || 'Unknown Error'}
      Message: ${error.message || 'No message available'}
      ============================
      `;

      console.error(formattedError);

      if (nodeManager.inJobLoop) {
        await nodeManager.delay();
        continue;
      } else {
        await nodeManager.stop();
        process.exit();
      }
    }
  }

  // try {
  //   await nodeManager.init();
  //   await nodeManager.start(market);
  // } catch (e) {
  //   const error = e as any;

  //   const formattedError = `
  //   ========== ERROR ==========
  //   Timestamp: ${new Date().toISOString()}
  //   Error Name: ${error.name || 'Unknown Error'}
  //   Message: ${error.message || 'No message available'}
  //   ============================
  //   `;

  //   console.error(formattedError);

  //   if (nodeManager.inJobLoop) {
  //     await nodeManager.restart(market);
  //   } else {
  //     await nodeManager.stop();
  //     process.exit();
  //   }
  // }
}

export async function startNode1(
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

  nodeDispatch(NODE_STATE_NAME.NODE_STARTING, {
    node: sdk.solana.wallet.publicKey.toString(),
  });

  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  node = new NosanaNode(
    sdk,
    options.provider,
    options.podman,
    options.config,
    options.gpu,
  );

  node.logger.override(
    ProviderEvents.INFO_LOG,
    (event: { log: string; type: string; pending: boolean }) => {
      if (!handlingSigInt) {
        node.logger.standard_info_log(event, spinner);
      }
    },
  );

  nodeDispatch(NODE_STATE_NAME.NODE_STARTED);

  try {
    nodeDispatch(NODE_STATE_NAME.PROVIDER_HEALTH_CHECKING);

    await node.provider.healthy();

    nodeDispatch(NODE_STATE_NAME.PROVIDER_HEALTH_PASSED);
  } catch (error) {
    console.log(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );

    nodeDispatch(NODE_STATE_NAME.PROVIDER_HEALTH_FAILED, {
      error: error,
    });

    throw error;
  }

  nodeDispatch(NODE_STATE_NAME.API_SERVER_STARTING);

  spinner = ora(chalk.cyan('Starting API')).start();

  try {
    await node.startAPI();

    nodeDispatch(NODE_STATE_NAME.API_SERVER_STARTED);
  } catch (error) {
    spinner.fail(chalk.red(`Could not start API`));

    nodeDispatch(NODE_STATE_NAME.API_SERVER_FAILED, {
      error: error,
    });

    throw error;
  }

  /****************
   *    Market    *
   ****************/
  let accessKey: PublicKey | undefined;
  if (!market) {
    // If we don't specify a market, try to join test grid
    ({ market, accessKey } = await node.joinTestGrid());
    // TODO: decouple resources in providers from markets/blockchain/backend stuff,
    //       that should be part of the node or cli..
    await node.provider.updateMarketRequiredResources(market);
  }

  nodeDispatch(NODE_STATE_NAME.RETRIVING_MARKET, {
    market: market,
  });

  let marketAccount: Market;
  try {
    spinner = ora(chalk.cyan('Retrieving market')).start();
    marketAccount = await node.sdk.jobs.getMarket(market);

    nodeDispatch(NODE_STATE_NAME.RETRIVING_MARKET_PASSED);

    spinner.stop();
    console.log(`Market:\t\t${chalk.greenBright.bold(market)}`);
    console.log('================================');
  } catch (e: any) {
    nodeDispatch(NODE_STATE_NAME.RETRIVING_MARKET_FAILED, {
      error: e,
    });

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

        nodeDispatch(NODE_STATE_NAME.JOINING_QUEUE);

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
              nodeDispatch(NODE_STATE_NAME.JOINING_QUEUE_FAILED, {
                error: e,
              });

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
            nodeDispatch(NODE_STATE_NAME.JOINING_QUEUE_FAILED, {
              error: e,
            });

            spinner.fail(chalk.red.bold('Could not join market'));
            throw e;
          }
          try {
            spinner = ora(chalk.cyan('Checking queued status')).start();
            await sleep(2);
            await node.checkQueued();
          } catch (e) {
            nodeDispatch(NODE_STATE_NAME.JOINING_QUEUE_FAILED, {
              error: e,
            });

            spinner.fail(chalk.red.bold('Could not check market queue'));

            throw e;
          }
        }

        nodeDispatch(NODE_STATE_NAME.JOINING_QUEUE_PASSED);

        if (node.market) {
          nodeDispatch(NODE_STATE_NAME.JOINED_QUEUE);

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

        nodeDispatch(NODE_STATE_NAME.JOB_STARTING, {
          job: jobAddress,
        });

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
          await node.provider.stopFlow(jobAddress);
          node.run = undefined;

          nodeDispatch(NODE_STATE_NAME.JOB_STARTING_FAILED, {
            error: new Error('Job has the wrong market, quiting job'),
          });
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
          await node.provider.stopFlow(jobAddress);
          node.run = undefined;

          nodeDispatch(NODE_STATE_NAME.JOB_STARTING_FAILED, {
            error: new Error('Job is expired, quiting job'),
          });
        } else {
          spinner = ora(chalk.cyan('Checking provider health')).start();
          try {
            await node.provider.healthy();
          } catch (error) {
            spinner.fail(
              chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
            );

            nodeDispatch(NODE_STATE_NAME.JOB_STARTING_FAILED, {
              error: error,
            });

            throw error;
          }

          nodeDispatch(NODE_STATE_NAME.JOB_RUNNING, {
            job: jobAddress,
          });

          let flowId = jobAddress;
          let result: Partial<FlowState> | null = null;
          const existingFlow = node.provider.getFlow(flowId);
          if (!existingFlow) {
            jobDispatch(JOB_STATE_NAME.RETREIVING_JOB_DEFINATION, {
              ipfs: job.ipfsJob,
            });

            spinner.text = chalk.cyan('Retrieving job definition');
            const jobDefinition: JobDefinition = await node.sdk.ipfs.retrieve(
              job.ipfsJob,
            );
            spinner.succeed(chalk.green('Retrieved job definition'));

            jobDispatch(JOB_STATE_NAME.RETREIVED_JOB_DEFINATION);

            jobDispatch(JOB_STATE_NAME.STARTING_NEW_FLOW, {
              flow: flowId,
            });

            // Create new flow
            flowId = node.provider.run(jobDefinition, flowId).id;
          } else {
            jobDispatch(JOB_STATE_NAME.CONTINUE_EXISTING_FLOW, {
              flow: flowId,
            });

            spinner.info(chalk.cyan('Continuing with existing flow'));
            node.provider.continueFlow(flowId);
          }

          if (!result) {
            jobDispatch(JOB_STATE_NAME.WAITING_FOR_JOB_TO_COMPLETE, {
              flow: flowId,
            });

            result = await node.waitForJob(marketAccount);
            if (result) {
              spinner.succeed(`Retrieved results with status ${result.status}`);
            }
          }
          if (result) {
            await node.finishJob(job, node.run.publicKey, result);

            nodeDispatch(NODE_STATE_NAME.JOB_COMPLETED, {
              status: result.status,
            });
          }
        }
      }
      spinner.stop();

      nodeDispatch(NODE_STATE_NAME.RESTARTING);

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
