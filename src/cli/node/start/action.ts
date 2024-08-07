import chalk from 'chalk';
import { Command } from 'commander';
import { Client, Job, KeyWallet, Market, Run } from '@nosana/sdk';
import ora, { type Ora } from 'ora';
import {
  BlockheightBasedTransactionConfirmationStrategy,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import 'rpc-websockets/dist/lib/client.js';

import { sleep, clearLine } from '../../../generic/utils.js';
import { NotQueuedError } from '../../../generic/errors.js';
import { DockerProvider } from '../../../providers/DockerProvider.js';
import {
  Provider,
  JobDefinition,
  FlowState,
  OperationArgsMap,
} from '../../../providers/Provider.js';
import { PodmanProvider } from '../../../providers/PodmanProvider.js';
import { getRawTransaction, getSDK } from '../../../services/sdk.js';
import { config } from '../../../generic/config.js';
import {
  getRun,
  checkQueued,
  waitForRun,
  isRunExpired,
  runBenchmark,
  healthCheck,
  NosanaNode,
} from '../../../services/nodes.js';

let node: NosanaNode;
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
  const onShutdown = async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      if (spinner) {
        spinner.stop();
      }
      console.log(chalk.yellow.bold('Shutting down..'));
      if (run) {
        spinner = ora(chalk.cyan('Quiting running job')).start();
        try {
          const tx = await node.sdk.jobs.quit(run);
          spinner.succeed(`Job successfully quit with tx ${tx}`);
        } catch (e: any) {
          spinner.fail(chalk.red.bold('Could not quit job'));
          const logLevel = cmd.optsWithGlobals().log;
          if (logLevel === 'debug') {
            console.error(e.message ? e.message : e);
          } else if (logLevel === 'trace') {
            console.error(e);
          }
        }
        await node.provider.stopFlow(run.publicKey.toString());
        await node.provider.waitForFlowFinish(run.publicKey.toString());
      } else if (selectedMarket) {
        spinner = ora(chalk.cyan('Leaving market queue')).start();
        try {
          const tx = await node.sdk.jobs.stop(selectedMarket.address);
          spinner.succeed(`Market queue successfully left with tx ${tx}`);
        } catch (e: any) {
          spinner.fail(chalk.red.bold('Could not quit market queue'));
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

  run = undefined;
  selectedMarket = undefined;
  const sdk: Client = getSDK();
  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  node = new NosanaNode(
    sdk,
    options.provider,
    options.podman,
    options.config,
  );

  try {
    await node.provider.healthy();
  } catch (error) {
    console.log(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }

  // sign message for authentication
  const signature = (await node.sdk.solana.signMessage(
    config.signMessage,
  )) as Uint8Array;
  const base64Signature = Buffer.from(signature).toString('base64');

  let nft: PublicKey | undefined;
  // TODO: should we even allow setting a custom market account?
  if (!market) {
    let nodeResponse: any;
    try {
      // Check if node is onboarded and has received access key
      // if not call onboard endpoint to create access key tx
      const response = await fetch(`${config.backendUrl}/nodes/${node.address}`, {
        method: 'GET',
        headers: {
          Authorization: `${node.address}:${base64Signature}`,
          'Content-Type': 'application/json',
        },
      });
      nodeResponse = await response.json();
      if (!nodeResponse || (nodeResponse && nodeResponse.name === 'Error')) {
        throw new Error(nodeResponse.message);
      }
      if (nodeResponse.status !== 'onboarded') {
        throw new Error('Node not onboarded yet');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Node not onboarded yet')) {
        throw new Error(
          chalk.yellow(
            'Node is still on the waitlist, wait until you are accepted.',
          ),
        );
      } else if (e instanceof Error && e.message.includes('Node not found')) {
        throw new Error(
          chalk.yellow(
            'Node is not registred yet. To register run the join-test-grid command.',
          ),
        );
      }
      throw e;
    }
    // benchmark
    let gpus = await runBenchmark(node.provider, spinner);

    try {
      spinner = ora(chalk.cyan('Matching GPU to correct market')).start();
      // if user didnt give market, ask the backend which market we can enter
      const response = await fetch(
        `${config.backendUrl}/nodes/${node.address}/check-market`,
        {
          method: 'POST',
          headers: {
            Authorization: `${node.address}:${base64Signature}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gpus,
          }),
        },
      );
      const data: any = await response.json();
      if (
        (data && data.name === 'Error' && data.message) ||
        !nodeResponse.accessKeyMint ||
        !nodeResponse.marketAddress
      ) {
        if (
          (data.message &&
            data.message.includes(
              'Assigned market doesnt support current GPU',
            )) ||
          !nodeResponse.accessKeyMint ||
          !nodeResponse.marketAddress
        ) {
          spinner.text = chalk.cyan('Setting market');
          let data: any;
          if (nodeResponse.accessKeyMint) {
            const sfts = [
              'EriVoySzVWF4NtNxQFCFASR4632N9sh9YumTjkhGkkgL',
              '4TNvuVu3cj3BXfyNi9QSExtwAMub5BLCCejq2GFiVjSJ',
              'Fw4AtMMaE1xVGwiFZRFL2jwMQsXh8NsffZTPg1JXgAfY',
              '2JzciMonVeQ4thsEgWiLNJ8EX6jW7uZjaJJQo5zVwB6o',
              '4WedXpV8rWZqYyKZUsuBeGBj3GafroFWFSKk16Ui6AeZ',
              'BX4yK1s8vAPuXdgbVSDBRgPPT3fRkWpvPFw8TptmKr7F',
              'Adx1F4QjYW76yq8fxTPaGedsApfRuZo3NadoYR9Ptse7',
              'Ds36m2NHLbq8GPHnbBfJtZHmNrCnuFkP5NXK9iXkTWXU',
              '2xo9j5zRkPpGzxmzreRA2n3818118EFvXbJUNh7NvyPS',
              '6JSckt68jTqFxNTskDsE8ZweVNxwas68HmGURnj2KKkz',
              'HdCbnZfQEpxPQg1NBwKFWeHMLL2rTTMPKGXAoJ5NN1rW',
              '6cyXqcj1CFZ4MhcZWSYRw5HmDz6hK8WuQTgLxhReQ7KX',
              '5PwUugNiPeZVmrdeP1WuEmWnpTYDZPbohMKsEwtHAMtL',
              '8t2BH4NEEtdcqWJf7WvQ4zgwx5ahH2e9fcxYUZJagCAR',
              'WFWWb3fHbf57gJTWoA3tBL35gfhR5h4azt719e8Cegt',
              '9cqXVN4pp5nspf788sw7cx1cM936W9K9Xai5va2Yo5nr',
            ];
            if (!sfts.includes(nodeResponse.accessKeyMint)) {
              // send nft to backend
              spinner.text = chalk.cyan('Sending back old access key');
              const maxRetries = 3;
              for (let tries = 0; tries < maxRetries; tries++) {
                try {
                  const nftTx = await node.sdk.solana.transferNft(
                    config.backendSolanaAddress,
                    nodeResponse.accessKeyMint,
                  );
                  if (!nftTx) throw new Error('Couldnt trade NFT');
                  await sleep(25); // make sure RPC can pick up on the transferred NFT
                  spinner.succeed('Access key sent back with tx ' + nftTx);
                  spinner = ora(chalk.cyan('Setting market')).start();
                  break;
                } catch (e: any) {
                  if (e.message.includes('Provided owner is not allowed')) {
                    spinner.warn('Access key not owned anymore');
                    spinner = ora(chalk.cyan('Setting market')).start();
                    break;
                  } else if (e.message.includes('custom program error: 0x1')) {
                    spinner.fail(
                      chalk.red(
                        `Unsufficient funds to transfer access key. Add some SOL to your wallet to cover transaction fees: ${chalk.cyan(
                          node.address,
                        )}`,
                      ),
                    );
                    throw e;
                  }
                  if (tries >= 2) {
                    if (e.message.includes('block height exceeded')) {
                      spinner.fail(
                        chalk.red(
                          `Couldn't transfer NFT, possibly due to Solana congestion. Please try again later`,
                        ),
                      );
                      throw e;
                    } else {
                      throw e;
                    }
                  }
                }
              }
            }
          }
          try {
            const response = await fetch(
              `${config.backendUrl}/nodes/change-market`,
              {
                method: 'POST',
                headers: {
                  Authorization: `${node.address}:${base64Signature}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  address: node.address,
                }),
              },
            );
            data = await response.json();
            if (!data || (data && data.name && data.name.includes('Error'))) {
              throw new Error(data.message);
            }
            try {
              // deserialize & send SFT tx
              const feePayer = (node.sdk.solana.provider?.wallet as KeyWallet)
                .payer;
              const recoveredTransaction = await getRawTransaction(
                Uint8Array.from(Object.values(data.tx)),
              );

              if (recoveredTransaction instanceof VersionedTransaction) {
                recoveredTransaction.sign([feePayer]);
              } else {
                recoveredTransaction.partialSign(feePayer);
              }
              const txnSignature =
                await node.sdk.solana.connection?.sendRawTransaction(
                  recoveredTransaction.serialize(),
                );

              const latestBlockHash =
                await node.sdk.solana.connection?.getLatestBlockhash();
              if (latestBlockHash && txnSignature) {
                const confirmStrategy: BlockheightBasedTransactionConfirmationStrategy =
                  {
                    blockhash: latestBlockHash.blockhash,
                    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                    signature: txnSignature,
                  };
                await node.sdk.solana.connection?.confirmTransaction(
                  confirmStrategy,
                );
              } else {
                throw new Error('Couldnt confirm minting transaction');
              }
              // console.log('txnSignature', txnSignature);
              await sleep(30);
              const response = await fetch(
                `${config.backendUrl}/nodes/sync-node`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `${node.address}:${base64Signature}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    address: node.address,
                  }),
                },
              );

              const sync = await response.json();
              // console.log('sync', sync);
            } catch (e: any) {
              spinner.fail();
              throw new Error(
                chalk.red('Couldnt send SFT transaction from backend ') +
                  e.message,
              );
            }
          } catch (e: any) {
            spinner.fail();
            throw new Error(
              chalk.red(
                'Something went wrong with minting your access key, please try again. ',
              ) + e.message,
            );
          }
          if (data && data.name && data.name.includes('Error')) {
            throw new Error(data.message);
          }
          market = data.newMarket;
          nft = new PublicKey(data.newMint);
        } else {
          throw new Error(data.message);
        }
      } else {
        // current GPU matches market
        market = data[1].market;
        nft = new PublicKey(nodeResponse.accessKeyMint);
      }
    } catch (e) {
      spinner.fail(chalk.red('Error checking or onboarding in market'));
      throw e;
    }
    spinner.succeed('Got access key for market: ' + market);
  }

  await provider.updateMarketRequiredResources(market);

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
  await node.healthCheck({
    spinner, // TODO: use callback for log events?
    market,
    marketAccount,
    nft,
    options,
  });

  /****************
   *   Job Loop   *
   ****************/
  const jobLoop = async (firstRun: Boolean = false): Promise<void> => {
    try {
      if (!firstRun) {
        await node.healthCheck({
          spinner, // TODO: use callback for log events?
          market,
          marketAccount,
          nft,
          options,
          printDetailed: false,
        });
      }
      spinner = ora(chalk.cyan('Checking existing runs')).start();

      // Check if we already have a run account
      run = await getRun(node.address);

      if (!run) {
        spinner.text = chalk.cyan('Checking queued status');
        selectedMarket = await checkQueued(node.address);

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
              const tx = await node.sdk.jobs.stop(selectedMarket.address);
              spinner.succeed(`Market queue successfully left with tx ${tx}`);
            } catch (e) {
              spinner.fail(chalk.red('Could not quit market queue'));
              throw e;
            }
            spinner = ora().start();
          }
          spinner.text = chalk.cyan(`Joining market ${chalk.bold(market)}`);
          try {
            const tx = await node.sdk.jobs.work(market, nft ? nft : undefined);
            spinner.succeed(chalk.greenBright(`Joined market tx ${tx}`));
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not join market'));
            throw e;
          }
          try {
            spinner = ora(chalk.cyan('Checking queued status')).start();
            await sleep(2);
            selectedMarket = await checkQueued(node.address);
          } catch (e) {
            spinner.fail(chalk.red.bold('Could not check market queue'));
            throw e;
          }
        }
        if (selectedMarket) {
          // Currently queued in a market, wait for run
          spinner.color = 'yellow';
          const queuedMarketText = (market: Market, node.address: string) => {
            return (
              chalk.bgYellow.bold(' QUEUED ') +
              ` at position ${
                market.queue.findIndex((e: any) => e.toString() === node.address) + 1
              }/${market.queue.length} in market ${chalk.cyan.bold(
                market.address,
              )}`
            );
          };
          spinner.text = queuedMarketText(selectedMarket, node.address);
          try {
            // will only return on a new run account
            run = await waitForRun(
              node.address,
              selectedMarket.address,
              // This callback gets called every minute with the updated market
              (market: Market) => {
                selectedMarket = market;
                spinner.text = queuedMarketText(selectedMarket, node.address);
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
          run = await getRun(node.address);
        }
      }
      if (run) {
        if (spinner) spinner.stop();
        const jobAddress = run.account.job.toString();
        console.log(chalk.green('Claimed job ') + chalk.green.bold(jobAddress));
        const job: Job = await node.sdk.jobs.get(jobAddress);
        if (job.market.toString() !== market) {
          spinner = ora(
            chalk.red('Job has the wrong market, quiting job'),
          ).start();
          try {
            const tx = await node.sdk.jobs.quit(run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await node.provider.stopFlow(run.publicKey.toString());
          run = undefined;
        } else if (
          isRunExpired(run, (marketAccount?.jobTimeout as number) * 1.5) &&
          1 + 1 === 3
        ) {
          // Quit job when timeout * 1.5 is reached.
          spinner = ora(chalk.red('Job is expired, quiting job')).start();
          try {
            const tx = await node.sdk.jobs.quit(run);
            spinner.succeed(`Job successfully quit with tx ${tx}`);
          } catch (e) {
            spinner.fail(chalk.red('Could not quit job'));
            throw e;
          }
          await node.provider.stopFlow(run.publicKey.toString());
          run = undefined;
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
          let stoppedExposedService = false;
          let flowId = run.publicKey.toString();
          let result: Partial<FlowState> | null = null;
          const existingFlow = node.provider.getFlow(flowId);
          if (!existingFlow) {
            spinner.text = chalk.cyan('Retrieving job definition');
            const jobDefinition: JobDefinition = await nosana.ipfs.retrieve(
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
            // console.log('Running job');
            // spinner.text = chalk.cyan('Running job');
            // TODO: move to node service (e.g. waitForResult)?
            result = await new Promise<FlowState | null>(async function (
              resolve,
              reject,
            ) {
              // check if expired every 30s
              const expireInterval = setInterval(async () => {
                const flow = node.provider.getFlow(flowId);
                if (flow) {
                  const isFlowExposed =
                    flow.jobDefinition.ops.filter(
                      (op) =>
                        op.type === 'container/run' &&
                        (op.args as OperationArgsMap['container/run']).expose,
                    ).length > 0;
                  if (isFlowExposed) {
                    // Finish the job if the job timeout has been reached and we expose a service
                    if (
                      isRunExpired(
                        run!,
                        // TODO: fix: due to a problem with the typescript Market type of getMarket(),
                        // we need to convert timeout to a number by multipling with an int
                        (marketAccount?.jobTimeout as number) * 1,
                      )
                    ) {
                      clearInterval(expireInterval);
                      spinner = ora(chalk.cyan('Stopping service')).start();
                      await node.provider.stopFlow(flowId);
                      stoppedExposedService = true;
                    }
                  } else {
                    // If flow doesn't have an exposed service, quit the job if not finished yet after 1.5
                    // times the job timeout
                    if (
                      isRunExpired(
                        run!,
                        (marketAccount?.jobTimeout as number) * 1.5,
                      )
                    ) {
                      clearInterval(expireInterval);
                      // Quit job when timeout * 1.5 is reached.
                      spinner = ora(
                        chalk.red('Job is expired, quiting job'),
                      ).start();
                      try {
                        const tx = await node.sdk.jobs.quit(run!);
                        spinner.succeed(`Job successfully quit with tx ${tx}`);
                        run = undefined;
                      } catch (e) {
                        spinner.fail(chalk.red.bold('Could not quit job'));
                        reject(e);
                      }
                      await node.provider.stopFlow(flowId);
                      reject('Job expired');
                    }
                  }
                }
              }, 30000);
              try {
                const flowResult = await node.provider.waitForFlowFinish(
                  flowId,
                  (event: { log: string; type: string }) => {
                    if (!handlingSigInt) {
                      if (event.type === 'info') {
                        if (spinner && spinner.isSpinning) {
                          spinner.succeed();
                        }
                        // TODO: create special type for spinners?
                        if (
                          event.log.includes('Running in container') ||
                          event.log.includes('Creating volume') ||
                          event.log.includes('Pulling image')
                        ) {
                          spinner = ora(event.log).start();
                        } else {
                          console.log(event.log);
                        }
                      }
                    }
                  },
                );
                if (spinner && spinner.isSpinning) {
                  spinner.succeed();
                }
                clearInterval(expireInterval);
                resolve(flowResult);
              } catch (e) {
                clearInterval(expireInterval);
                if (spinner && spinner.isSpinning) {
                  spinner.fail();
                }
                throw e;
              }
            });
            if (result) {
              spinner.succeed(`Retrieved results with status ${result.status}`);
            }
          }
          if (result) {
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
              const tx = await node.sdk.jobs.submitResult(
                bytesArray,
                run.publicKey,
                job.market.toString(),
              );
              run = undefined;
              selectedMarket = undefined;
              spinner.succeed(
                chalk.green('Job finished ') + chalk.green.bold(tx),
              );
              // TODO: remove stoppedExposedService check when we fixed the exit state of stopped flows
              if (result.status !== 'success' && !stoppedExposedService) {
                // Flow failed, so we have a cooldown of 15 minutes
                console.log(chalk.cyan('Waiting to enter the queue'));
                await sleep(900);
              }
            } catch (e) {
              spinner.fail(chalk.red.bold('Could not finish job'));
              throw e;
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
    jobLoop(false);
  };
  jobLoop(true);
}
