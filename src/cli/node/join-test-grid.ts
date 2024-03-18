import { DockerProvider } from '../../providers/DockerProvider';
import {
  Provider,
  Flow,
  JobDefinition,
  validateJobDefinition,
  FlowState,
} from '../../providers/Provider';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { IValidation } from 'typia';
import { PodmanProvider } from '../../providers/PodmanProvider';
import { Client, Job, Market, sleep } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import { PublicKey } from '@solana/web3.js';
import { checkQueued, getRun, isRunExpired, waitForRun } from '../../services/nodes';
import { NotQueuedError } from '../../generic/errors';
import { clearLine } from '../../generic/utils';

let provider: Provider;
let selectedMarket: Market | void;

export async function runBenchmark(options: { [key: string]: any }) {
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

  let spinner: Ora;
  // TODO: set this in config file
  let market = 'U3p4uaAMi1Am5frDP6jfjN1zbCroLer3h8zT4SEyKSx';
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();

  switch (options.provider) {
    case 'podman':
      provider = new PodmanProvider(options.podman);
      break;
    case 'docker':
    default:
      provider = new DockerProvider(options.podman);
      break;
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

  let marketAccount: Market;
  spinner = ora(chalk.cyan('Retrieving market')).start();
  try {
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

  spinner.text = chalk.cyan('Checking queued status');
  try {
    selectedMarket = await checkQueued(node, new PublicKey(market));  
  } catch (error) {
    console.error(error);
  }

  let run = await getRun(node);
  if (!run) {
    if (!selectedMarket || selectedMarket.address.toString() !== market) {
      spinner.text = chalk.cyan(`Joining market ${chalk.bold(market)}`);
      try {
        const tx = await nosana.jobs.work(market);
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
          chalk.bgYellow.bold(' QUEUED, no benchmarks available at the moment. You are ') +
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

  // Run found, run job
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
        spinner.text = chalk.cyan('Running benchmark');
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
      spinner = ora(chalk.cyan('Finishing benchmark')).start();
      try {
        const tx = await nosana.jobs.submitResult(
          bytesArray,
          run.publicKey,
          job.market.toString(),
        );
        spinner.succeed(chalk.green('Benchmark finished, receipt: ') + chalk.green.bold(tx));
        console.log('================================');
        console.log(chalk.green('Registration code:', flowId));
      } catch (e) {
        spinner.fail(chalk.red.bold('Could not finish benchmark'));
        throw e;
      }
      spinner.stop();
    }
  }
}
