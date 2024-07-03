import { Client, Market, Run } from '@nosana/sdk';
import { getSDK } from './sdk.js';
import 'rpc-websockets/dist/lib/client.js';
import { ClientSubscriptionId, PublicKey, TokenAmount } from '@solana/web3.js';
import { NotQueuedError } from '../generic/errors.js';
import benchmarkGPU from '../static/benchmark-gpu.json' assert { type: 'json' };
import { CudaCheckResponse } from '../commands/node/types.js';
import { FlowState, JobDefinition, Provider } from '../providers/Provider.js';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { sleep } from '../generic/utils.js';
import { EMPTY_ADDRESS } from './jobs.js';
import { config } from '../config/index.js';

export type NodeStats = {
  sol: number;
  nos: TokenAmount | undefined;
  stake: number;
  nfts: Array<PublicKey>;
};

export type HealthCheckArgs = {
  node: string;
  provider: Provider;
  spinner: Ora;
  market: string;
  marketAccount: Market | null;
  nft?: PublicKey | undefined;
  options: { [key: string]: any };
  printDetailed?: boolean;
};

export const getNodeStats = async (
  node: PublicKey | string,
): Promise<NodeStats> => {
  const nosana: Client = getSDK();

  const solBalance = await nosana.solana.getSolBalance(node);
  const nosBalance = await nosana.solana.getNosBalance(node);

  return {
    sol: solBalance,
    nos: nosBalance,
    stake: 0,
    nfts: [],
  };
};

export const getRun = async (node: string): Promise<Run | void> => {
  const nosana: Client = getSDK();
  const runs = await nosana.jobs.getRuns([
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    },
  ]);
  if (runs && runs.length > 0) {
    return runs[0];
  }
};

export const isRunExpired = (run: Run, expireTime: number): Boolean => {
  const now = Date.now() / 1000;
  // @ts-expect-error Type is wrong, its not a number but a BN
  return run.account.time.toNumber() + expireTime < now;
};

export const waitForRun = async (
  node: string,
  market?: PublicKey,
  enableQueueCheck: Function | boolean = false,
): Promise<Run> => {
  const nosana: Client = getSDK();
  await nosana.jobs.loadNosanaJobs();
  const jobProgram = nosana.jobs.jobs!;
  const runAccountFilter: { offset: number; bytes: string } =
    jobProgram.coder.accounts.memcmp(
      jobProgram.account.runAccount.idlAccount.name,
      undefined,
    );
  const coderFilters = [
    {
      memcmp: {
        offset: runAccountFilter.offset,
        bytes: runAccountFilter.bytes,
      },
    },
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    },
  ];
  let subscriptionId: ClientSubscriptionId;
  let getRunsInterval: NodeJS.Timeout;
  let checkQueuedInterval: NodeJS.Timeout;
  return new Promise<Run>(function (resolve, reject) {
    if (enableQueueCheck) {
      // check if we are still queued in a market every 2 minutes
      checkQueuedInterval = setInterval(async () => {
        try {
          const selectedMarket = await checkQueued(node, market);
          if (!selectedMarket) {
            reject(new NotQueuedError('Node not queued anymore'));
          } else {
            if (enableQueueCheck instanceof Function) {
              enableQueueCheck(selectedMarket);
            }
          }
        } catch (e) {
          console.warn('\nCould not update queue status');
        }
      }, 60000 * 2);
    }

    // As a fallback for the run events, runs every 5 minutes
    getRunsInterval = setInterval(async () => {
      try {
        const run: Run | void = await getRun(node);
        if (run) resolve(run);
      } catch (e) {
        console.warn('\nCould not check for new runs');
      }
    }, 60000 * 5);
    subscriptionId = nosana.jobs.connection!.onProgramAccountChange(
      jobProgram.programId,
      async (event) => {
        const runAccount = jobProgram.coder.accounts.decode(
          jobProgram.account.runAccount.idlAccount.name,
          event.accountInfo.data,
        );
        const run: Run = {
          account: runAccount,
          publicKey: event.accountId,
        };
        resolve(run);
      },
      'confirmed',
      coderFilters,
    );
  })
    .then((run) => {
      if (typeof subscriptionId !== 'undefined')
        nosana.jobs.connection!.removeProgramAccountChangeListener(
          subscriptionId,
        );
      if (getRunsInterval) clearInterval(getRunsInterval);
      if (checkQueuedInterval) clearInterval(checkQueuedInterval);
      return run;
    })
    .catch((error) => {
      if (typeof subscriptionId !== 'undefined')
        nosana.jobs.connection!.removeProgramAccountChangeListener(
          subscriptionId,
        );
      if (getRunsInterval) clearInterval(getRunsInterval);
      if (checkQueuedInterval) clearInterval(checkQueuedInterval);
      throw error;
    });
};

export const checkQueued = async (
  node: string,
  market?: PublicKey,
): Promise<Market | void> => {
  const nosana: Client = getSDK();
  let markets: Array<Market>;
  if (market) {
    // Only fetch specified market
    markets = [await nosana.jobs.getMarket(market)];
  } else {
    // Fetch all markets if market is not specified
    markets = await nosana.jobs.allMarkets();
  }
  // check markets and see if the node is in the queue
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    if (
      market &&
      market.queue &&
      market.queue.find((e: PublicKey) => e.toString() === node)
    ) {
      return market;
    }
  }
};

export const runBenchmark = async (
  provider: Provider,
  spinner: Ora,
  printDetailed: boolean = true,
): Promise<string> => {
  let gpus: string;
  try {
    /****************
     * Benchmark *
     ****************/
    let result: Partial<FlowState> | null;
    if (printDetailed) {
      console.log(chalk.cyan('Running benchmark'));
    }
    // Create new flow
    const flow = provider.run(benchmarkGPU as JobDefinition);
    result = await provider.waitForFlowFinish(
      flow.id,
      (event: { log: string; type: string }) => {
        if (printDetailed) {
          if (event.type === 'info') {
            if (spinner && spinner.isSpinning) {
              spinner.succeed();
            }
            if (
              event.log.includes('Creating volume') ||
              event.log.includes('Pulling image')
            ) {
              spinner = ora(event.log).start();
            } else {
              console.log(event.log);
            }
          } else if (event.type === 'stdout') {
            process.stdout.write(event.log);
          } else {
            process.stderr.write(event.log);
          }
        }
      },
    );
    if (spinner && spinner.isSpinning) {
      spinner.succeed();
    }
    if (
      result &&
      result.status === 'success' &&
      result.opStates &&
      result.opStates[0] &&
      result.opStates[1]
    ) {
      // GPU
      if (!result.opStates[0].logs)
        throw new Error('Cannot find GPU benchmark output');

      const { devices } = JSON.parse(
        result.opStates[0].logs[0].log!,
      ) as CudaCheckResponse;

      if (!devices) {
        throw new Error('GPU benchmark returned with no devices');
      }

      gpus = result.opStates[0].logs[0]!.log!;

      if (!result.opStates[1].logs)
        throw new Error(`Can't find disk space output`);

      // Disk space
      for (let i = 0; i < result.opStates[1].logs.length; i++) {
        let ds = result.opStates[1].logs[i];
        if (ds.log) {
          // in MB
          const availableDiskSpace = parseInt(ds.log);
          if (config.minDiskSpace > availableDiskSpace) {
            throw new Error(
              `Not enough disk space available, found ${
                availableDiskSpace / 1000
              } GB available. Needs minimal ${config.minDiskSpace / 1000} GB.`,
            );
          }
        } else {
          throw new Error(`Can't find disk space output`);
        }
      }
    } else if (result && result.status === 'failed' && result.opStates) {
      const output = [];

      if (result.opStates[0]) {
        const { error } = JSON.parse(
          result.opStates[0].logs[0].log!,
        ) as CudaCheckResponse;

        if (error) {
          output.push(
            `GPU benchmark failed, please ensure your NVidia Cuda runtime drivers are up to date and your NVidia Container Toolkit is correctly configured.`,
          );
        }

        output.push(result.opStates[0].logs);
      }

      if (result.opStates[1]) {
        output.push(result.opStates[1].logs);
      }
      throw output;
    } else {
      throw 'Cant find results';
    }
  } catch (e: any) {
    console.error(
      chalk.red('Something went wrong while detecting hardware', e),
    );
    throw e;
  }
  return gpus;
};

export const healthCheck = async ({
  node,
  provider,
  spinner,
  market,
  marketAccount,
  nft,
  options,
  printDetailed = true,
}: HealthCheckArgs) => {
  const nosana: Client = getSDK();
  if (printDetailed) {
    spinner = ora(chalk.cyan('Checking SOL balance')).start();
  } else {
    spinner = ora(chalk.cyan('Health checks')).start();
    // only run benchmark when it isnt first run of healthCheck as it already ran on start
    await runBenchmark(provider, spinner, printDetailed);
  }
  let stats: NodeStats | null = null;
  try {
    stats = await getNodeStats(node);
  } catch (e) {
    spinner.warn('Could not check SOL balance, make sure you have enough SOL');
  }
  if (stats) {
    const solBalance = stats.sol / 1e9;
    if (solBalance < 0.005) {
      spinner.fail(chalk.red.bold('Not enough SOL balance'));
      throw new Error(
        `SOL balance ${solBalance} should be 0.005 or higher. Send some SOL to your node address ${chalk.cyan(
          node,
        )} `,
      );
    }
    if (printDetailed) {
      spinner.succeed(chalk.green(`Sol balance: ${chalk.bold(solBalance)}`));
    }
  }
  if (printDetailed) {
    spinner = ora(chalk.cyan('Checking provider health')).start();
  }
  try {
    await provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }

  if (printDetailed) {
    spinner.succeed(
      chalk.green(`Podman is running on ${chalk.bold(options.podman)}`),
    );
  }

  try {
    // create NOS ATA if it doesn't exists
    await nosana.solana.createNosAta(node);
  } catch (error) {
    throw error;
  }

  let stake;
  try {
    if (printDetailed) {
      spinner = ora(chalk.cyan('Checking stake account')).start();
    }
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
  if (printDetailed) {
    spinner.succeed(
      chalk.green(
        `Stake found with ${chalk.bold(stake.amount / 1e6)} NOS staked`,
      ),
    );
  }
  try {
    if (marketAccount!.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()) {
      if (printDetailed) {
        spinner.succeed(chalk.green(`Open market ${chalk.bold(market)}`));
      }
    } else {
      if (printDetailed) {
        spinner.text = chalk.cyan(
          `Checking required access key for market ${chalk.bold(market)}`,
        );
      }
      const nftFromChain = await nosana.solana.getNftFromCollection(
        node,
        marketAccount!.nodeAccessKey.toString(),
      );
      if (nftFromChain) {
        nft = nftFromChain;
        if (printDetailed) {
          spinner.succeed(
            chalk.green(
              `Found access key ${chalk.bold(nft)} for market ${chalk.bold(
                market,
              )}`,
            ),
          );
        }
      } else {
        if (!nft) {
          throw new Error('Could not find access key');
        }
        spinner.succeed(
          chalk.yellow(
            `Could not find key on-chain, trying access key ${chalk.bold(
              nft,
            )} for market ${chalk.bold(market)}`,
          ),
        );
      }
    }
  } catch (e: any) {
    spinner.fail(chalk.red(`Denied access to market ${chalk.bold(market)}`));
    throw e;
  }
  if (!printDetailed) {
    spinner.succeed('Health checks passed');
  }
};
