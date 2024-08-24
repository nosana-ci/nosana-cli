import chalk from 'chalk';
import { Client, Job, KeyWallet, Market, Run } from '@nosana/sdk';
import {
  ClientSubscriptionId,
  PublicKey,
  TokenAmount,
  VersionedTransaction,
  BlockheightBasedTransactionConfirmationStrategy,
} from '@solana/web3.js';
import 'rpc-websockets/dist/lib/client.js';
import { NotQueuedError } from '../generic/errors.js';
import { CudaCheckResponse } from '../types/cudaCheck.js';
import {
  FlowState,
  JobDefinition,
  OperationArgsMap,
} from '../providers/Provider.js';
import { getRawTransaction } from './sdk.js';
import { sleep } from '../generic/utils.js';
import { EMPTY_ADDRESS } from './jobs.js';
import { config } from '../generic/config.js';
import { PodmanProvider } from '../providers/PodmanProvider.js';
import { DockerProvider, FRPC_IMAGE } from '../providers/DockerProvider.js';

// TODO: make generic logger for both NosanaNode and provider
import Logger from '../providers/modules/logger/index.js';
import { api } from './api.js';
import { initTunnel } from './tunnel.js';
export const TUNNEL_IMAGE = 'registry.hub.docker.com/nosana/tunnel:0.1.0';
import { benchmarkGPU } from '../static/staticsImports.js';

export type NodeStats = {
  sol: number;
  nos: TokenAmount | undefined;
  stake: number;
  nfts: Array<PublicKey>;
};

export type HealthCheckArgs = {
  market: string;
  marketAccount: Market | null;
  accessKey?: PublicKey | undefined;
  printDetailed?: boolean;
};

export type HealthCheckResponse = {
  accessKey: PublicKey | undefined;
};

export class NosanaNode {
  public provider: DockerProvider | PodmanProvider;
  public sdk: Client;
  public address: string;
  public market: Market | void = undefined;
  public run: Run | void = undefined;
  public logger: Logger;

  constructor(
    client: Client,
    providerName = 'podman',
    providerUrl = 'http://localhost:8080',
    configLocation = '~/.nosana/',
  ) {
    this.logger = new Logger();
    switch (providerName) {
      case 'podman':
        this.provider = new PodmanProvider(
          providerUrl,
          configLocation,
          this.logger,
        );
        break;
      case 'docker':
      default:
        this.provider = new DockerProvider(
          providerUrl,
          configLocation,
          this.logger,
        );
        break;
    }
    this.sdk = client;
    this.address = this.sdk.solana.provider!.wallet.publicKey.toString();
  }

  public async ensureContainerDoesNotExist(containerName: string) {
    const existingContainer = await this.provider.getContainer(containerName);

    if (existingContainer) {
      await this.provider.stopAndRemoveContainer(containerName);
    }
  }

  public async startAPI(): Promise<number> {
    const networkName = 'api-' + this.address;
    await this.provider.docker.createNetwork({ Name: networkName });
    const networks: { [key: string]: {} } = {};
    networks[networkName] = {};
    const port = await api.start(this);
    // TODO: move to config;
    const tunnel_port = 3000;
    const tunnel_name = 'tunnel-api-' + this.address;
    try {
      await this.provider.pullImage(FRPC_IMAGE);
    } catch (error: any) {
      throw new Error(chalk.red(`Cannot pull image ${FRPC_IMAGE}: `) + error);
    }
    try {
      await this.provider.pullImage(TUNNEL_IMAGE);
    } catch (error: any) {
      throw new Error(chalk.red(`Cannot pull image ${TUNNEL_IMAGE}: `) + error);
    }

    await this.ensureContainerDoesNotExist(tunnel_name);

    await this.provider.runContainer(TUNNEL_IMAGE, {
      name: tunnel_name,
      networks,
      env: {
        PORT: tunnel_port.toString(),
      },
    });

    await this.ensureContainerDoesNotExist('frpc-api-' + this.address);

    await this.provider.runContainer(FRPC_IMAGE, {
      name: 'frpc-api-' + this.address,
      cmd: ['-c', '/etc/frp/frpc.toml'],
      networks,
      env: {
        FRP_SERVER_ADDR: config.frp.serverAddr,
        FRP_SERVER_PORT: config.frp.serverPort.toString(),
        FRP_NAME: 'API-' + this.address,
        FRP_LOCAL_IP: tunnel_name,
        FRP_LOCAL_PORT: tunnel_port.toString(),
        FRP_CUSTOM_DOMAIN: this.address + '.' + config.frp.serverAddr,
      },
    });
    const tunnelServer = `https://${this.address}.${config.frp.serverAddr}`;
    await sleep(3);
    initTunnel({ server: tunnelServer, port });
    this.logger.succeed(
      chalk.cyan(`Node API running at ${chalk.bold(tunnelServer)}`),
    );
    return port;
  }

  public async checkRun(): Promise<Run | void> {
    const runs = await this.sdk.jobs.getRuns([
      {
        memcmp: {
          offset: 40,
          bytes: this.address,
        },
      },
    ]);
    if (runs && runs.length > 0) {
      this.run = runs[0];
      this.market = undefined;
      return runs[0];
    }
    this.run = undefined;
  }

  public async waitForJob(): Promise<FlowState | null> {
    return new Promise<FlowState | null>(async (resolve, reject) => {
      // check if expired every 30s
      const expireInterval = setInterval(async () => {
        const flow = this.provider.getFlow(this.run!.publicKey.toString());
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
              NosanaNode.isRunExpired(
                this.run!,
                // TODO: fix: due to a problem with the typescript Market type of getMarket(),
                // we need to convert timeout to a number by multipling with an int
                (this.market?.jobTimeout as number) * 1,
              )
            ) {
              clearInterval(expireInterval);
              this.logger.log(chalk.cyan('Stopping service'), true);
              await this.provider.stopFlow(this.run!.publicKey.toString());
            }
          } else {
            // If flow doesn't have an exposed service, quit the job if not finished yet after 1.5
            // times the job timeout
            if (
              NosanaNode.isRunExpired(
                this.run!,
                (this.market?.jobTimeout as number) * 1.5,
              )
            ) {
              clearInterval(expireInterval);
              // Quit job when timeout * 1.5 is reached.
              this.logger.log(chalk.red('Job is expired, quiting job'), true);
              try {
                const tx = await this.sdk.jobs.quit(this.run!);
                this.logger.succeed(`Job successfully quit with tx ${tx}`);
                this.run = undefined;
              } catch (e) {
                this.logger.fail(chalk.red.bold('Could not quit job'));
                reject(e);
              }
              await this.provider.stopFlow(this.run!.publicKey.toString());
              reject('Job expired');
            }
          }
        }
      }, 30000);
      try {
        const flowResult = await this.provider.waitForFlowFinish(
          this.run!.publicKey.toString(),
        );
        this.logger.succeed();
        clearInterval(expireInterval);
        resolve(flowResult);
      } catch (e) {
        clearInterval(expireInterval);
        this.logger.fail();
        throw e;
      }
    });
  }

  public async checkQueued(market?: PublicKey): Promise<Market | void> {
    let markets: Array<Market>;
    if (market) {
      // Only fetch specified market
      markets = [await this.sdk.jobs.getMarket(market)];
    } else {
      // Fetch all markets if market is not specified
      markets = await this.sdk.jobs.allMarkets();
    }
    // check markets and see if the node is in the queue
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      if (
        market &&
        market.queue &&
        market.queue.find((e: PublicKey) => e.toString() === this.address)
      ) {
        this.market = market;
        return market;
      }
    }
    // Not in queue
    this.market = undefined;
  }

  public async waitForRun(
    market?: PublicKey,
    enableQueueCheck: Function | boolean = false,
  ): Promise<Run> {
    await this.sdk.jobs.loadNosanaJobs();
    const jobProgram = this.sdk.jobs.jobs!;
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
          bytes: this.address,
        },
      },
    ];
    let subscriptionId: ClientSubscriptionId;
    let getRunsInterval: NodeJS.Timeout;
    let checkQueuedInterval: NodeJS.Timeout;
    return new Promise<Run>((resolve, reject) => {
      if (enableQueueCheck) {
        // check if we are still queued in a market every 2 minutes
        checkQueuedInterval = setInterval(async () => {
          try {
            const queuedMarketInfo = await this.checkQueued(market);
            if (!queuedMarketInfo) {
              reject(new NotQueuedError('Node not queued anymore'));
            } else {
              if (enableQueueCheck instanceof Function) {
                enableQueueCheck(queuedMarketInfo);
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
          const run: Run | void = await this.checkRun();
          if (run) {
            resolve(run);
          }
        } catch (e) {
          console.warn('\nCould not check for new runs');
        }
      }, 60000 * 5);
      subscriptionId = this.sdk.jobs.connection!.onProgramAccountChange(
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
        this.run = run;
        if (typeof subscriptionId !== 'undefined')
          this.sdk.jobs.connection!.removeProgramAccountChangeListener(
            subscriptionId,
          );
        if (getRunsInterval) clearInterval(getRunsInterval);
        if (checkQueuedInterval) clearInterval(checkQueuedInterval);
        return run;
      })
      .catch((error) => {
        if (typeof subscriptionId !== 'undefined')
          this.sdk.jobs.connection!.removeProgramAccountChangeListener(
            subscriptionId,
          );
        if (getRunsInterval) clearInterval(getRunsInterval);
        if (checkQueuedInterval) clearInterval(checkQueuedInterval);
        throw error;
      });
  }

  public async finishJob(job: Job, run: PublicKey, result: Partial<FlowState>) {
    this.logger.log(chalk.cyan('Uploading results to IPFS'), true);
    let ipfsResult: string;
    try {
      ipfsResult = await this.sdk.ipfs.pin(result as object);
      this.logger.succeed(`Uploaded results to IPFS ${ipfsResult}`);
    } catch (e) {
      this.logger.fail(chalk.red.bold('Could not upload results to IPFS'));
      throw e;
    }
    const bytesArray = this.sdk.ipfs.IpfsHashToByteArray(ipfsResult);
    this.logger.log(chalk.cyan('Finishing job'), true);
    try {
      const tx = await this.sdk.jobs.submitResult(
        bytesArray,
        run,
        job.market.toString(),
      );
      if (this.run && this.run.publicKey.toString() === run.toString()) {
        // Clear run if we just finished the set run in the node
        this.run = undefined;
      }
      this.logger.succeed(chalk.green('Job finished ') + chalk.green.bold(tx));
    } catch (e) {
      this.logger.fail(chalk.red.bold('Could not finish job'));
      throw e;
    }
  }

  public async getNodeStats(): Promise<NodeStats> {
    const solBalance = await this.sdk.solana.getSolBalance(this.address);
    const nosBalance = await this.sdk.solana.getNosBalance(this.address);

    return {
      sol: solBalance,
      nos: nosBalance,
      stake: 0,
      nfts: [],
    };
  }

  public async healthCheck({
    market,
    marketAccount,
    accessKey,
    printDetailed = true,
  }: HealthCheckArgs): Promise<HealthCheckResponse> {
    if (printDetailed) {
      this.logger.log(chalk.cyan('Checking SOL balance'), true);
    } else {
      this.logger.log(chalk.cyan('Health checks'), true);
      // only run benchmark when it isnt first run of healthCheck as it already ran on start
      await this.runBenchmark(false);
    }
    let stats: NodeStats | null = null;
    try {
      stats = await this.getNodeStats();
    } catch (e) {
      this.logger.fail(
        'Could not check SOL balance, make sure you have enough SOL',
      );
    }
    if (stats) {
      const solBalance = stats.sol / 1e9;
      if (solBalance < 0.005) {
        this.logger.fail(chalk.red.bold('Not enough SOL balance'));
        throw new Error(
          `SOL balance ${solBalance} should be 0.005 or higher. Send some SOL to your node address ${chalk.cyan(
            this.address,
          )} `,
        );
      }
      if (printDetailed) {
        this.logger.succeed(
          chalk.green(`Sol balance: ${chalk.bold(solBalance)}`),
        );
      }
    }
    if (printDetailed) {
      this.logger.log(chalk.cyan('Checking provider health'), true);
    }
    try {
      await this.provider.healthy();
    } catch (error) {
      this.logger.fail(
        chalk.red(`${chalk.bold(this.provider.name)} provider not healthy`),
      );
      throw error;
    }

    if (printDetailed) {
      this.logger.succeed(
        chalk.green(
          `${chalk.bold(this.provider.name)} is running on ${chalk.bold(
            `${this.provider.protocol}://${this.provider.host}:${this.provider.port}`,
          )}`,
        ),
      );
    }

    try {
      // create NOS ATA if it doesn't exists
      await this.sdk.solana.createNosAta(this.address);
    } catch (error) {
      throw error;
    }

    let stake;
    try {
      if (printDetailed) {
        this.logger.log(chalk.cyan('Checking stake account'), true);
      }
      stake = await this.sdk.stake.get(this.address);
    } catch (error: any) {
      if (error.message && error.message.includes('Account does not exist')) {
        this.logger.log(chalk.cyan('Creating stake account'), true);
        // If no stake account: create empty stake account
        await this.sdk.stake.create(new PublicKey(this.address), 0, 14);
        await sleep(2);
        stake = await this.sdk.stake.get(this.address);
      } else {
        throw error;
      }
    }
    if (printDetailed) {
      this.logger.succeed(
        chalk.green(
          `Stake found with ${chalk.bold(stake.amount / 1e6)} NOS staked`,
        ),
      );
    }
    try {
      if (
        marketAccount!.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()
      ) {
        if (printDetailed) {
          this.logger.succeed(chalk.green(`Open market ${chalk.bold(market)}`));
        }
      } else {
        if (printDetailed) {
          this.logger.log(
            chalk.cyan(
              `Checking required access key for market ${chalk.bold(market)}`,
            ),
            true,
          );
        }
        const accessKeyFromChain = await this.sdk.solana.getNftFromCollection(
          this.address,
          marketAccount!.nodeAccessKey.toString(),
        );
        if (accessKeyFromChain) {
          accessKey = accessKeyFromChain;
          if (printDetailed) {
            this.logger.succeed(
              chalk.green(
                `Found access key ${chalk.bold(
                  accessKey,
                )} for market ${chalk.bold(market)}`,
              ),
            );
          }
        } else {
          if (!accessKey) {
            throw new Error('Could not find access key');
          }
          this.logger.succeed(
            chalk.yellow(
              `Could not find key on-chain, trying access key ${chalk.bold(
                accessKey,
              )} for market ${chalk.bold(market)}`,
            ),
          );
        }
      }
    } catch (e: any) {
      this.logger.fail(
        chalk.red(`Denied access to market ${chalk.bold(market)}`),
      );
      throw e;
    }
    if (!printDetailed) {
      this.logger.succeed('Health checks passed');
    }
    return { accessKey };
  }

  public async runBenchmark(printDetailed: boolean = true): Promise<string> {
    let gpus: string;
    try {
      /****************
       * Benchmark *
       ****************/
      let result: Partial<FlowState> | null;
      if (printDetailed) {
        this.logger.log(chalk.cyan('Running benchmark'));
      }

      // Create new flow
      const flow = this.provider.run(benchmarkGPU);
      result = await this.provider.waitForFlowFinish(
        flow.id,
        (event: { log: string; type: string }) => {
          if (printDetailed) {
            if (event.type === 'stdout') {
              process.stdout.write(event.log);
            } else {
              process.stderr.write(event.log);
            }
          }
        },
      );
      this.logger.succeed();
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
                } GB available. Needs minimal ${
                  config.minDiskSpace / 1000
                } GB.`,
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
  }

  public async joinTestGrid(): Promise<{
    market: string;
    accessKey: PublicKey;
  }> {
    let market: string;
    let accessKey: PublicKey;
    // sign message for authentication
    const signature = (await this.sdk.solana.signMessage(
      config.signMessage,
    )) as Uint8Array;
    const base64Signature = Buffer.from(signature).toString('base64');
    // If we don't specify a market, try to get the correct market from the backend
    let nodeResponse: any;
    try {
      // Check if node is onboarded and has received access key
      // if not call onboard endpoint to create access key tx
      const response = await fetch(
        `${config.backendUrl}/nodes/${this.address}`,
        {
          method: 'GET',
          headers: {
            Authorization: `${this.address}:${base64Signature}`,
            'Content-Type': 'application/json',
          },
        },
      );
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
    let gpus = await this.runBenchmark(false);

    try {
      this.logger.log(chalk.cyan('Matching GPU to correct market'), true);
      // if user didnt give market, ask the backend which market we can enter
      const response = await fetch(
        `${config.backendUrl}/nodes/${this.address}/check-market`,
        {
          method: 'POST',
          headers: {
            Authorization: `${this.address}:${base64Signature}`,
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
          this.logger.log(chalk.cyan('Setting market'), true);
          let data: any;
          try {
            const response = await fetch(
              `${config.backendUrl}/nodes/change-market`,
              {
                method: 'POST',
                headers: {
                  Authorization: `${this.address}:${base64Signature}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  address: this.address,
                }),
              },
            );
            data = await response.json();
            if (!data || (data && data.name && data.name.includes('Error'))) {
              throw new Error(data.message);
            }
            try {
              // deserialize & send SFT tx
              const feePayer = (this.sdk.solana.provider?.wallet as KeyWallet)
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
                await this.sdk.solana.connection?.sendRawTransaction(
                  recoveredTransaction.serialize(),
                );

              const latestBlockHash =
                await this.sdk.solana.connection?.getLatestBlockhash();
              if (latestBlockHash && txnSignature) {
                const confirmStrategy: BlockheightBasedTransactionConfirmationStrategy =
                  {
                    blockhash: latestBlockHash.blockhash,
                    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                    signature: txnSignature,
                  };
                await this.sdk.solana.connection?.confirmTransaction(
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
                    Authorization: `${this.address}:${base64Signature}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    address: this.address,
                  }),
                },
              );

              const sync = await response.json();
              // console.log('sync', sync);
            } catch (e: any) {
              this.logger.fail();
              throw new Error(
                chalk.red('Couldnt send SFT transaction from backend ') +
                  e.message,
              );
            }
          } catch (e: any) {
            this.logger.fail();
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
          accessKey = new PublicKey(data.newMint);
        } else {
          throw new Error(data.message);
        }
      } else {
        // current GPU matches market
        market = data.address;
        accessKey = new PublicKey(nodeResponse.accessKeyMint);
      }
    } catch (e) {
      this.logger.fail(chalk.red('Error checking or onboarding in market'));
      throw e;
    }
    this.logger.succeed('Got access key for market: ' + market);
    return { market, accessKey };
  }
  public async shutdown() {
    // Shutdown API frpc container + tunnel
    const tunnelName = 'tunnel-api-' + this.address;
    await this.provider.stopAndRemoveContainer(tunnelName);
    const apiName = 'frpc-api-' + this.address;
    await this.provider.stopAndRemoveContainer(apiName);

    if (this.run) {
      this.logger.log(chalk.cyan('Quiting running job'), true);
      try {
        const tx = await this.sdk.jobs.quit(this.run);
        this.logger.succeed(`Job successfully quit with tx ${tx}`);
      } catch (e: any) {
        this.logger.fail(chalk.red.bold('Could not quit job'));
        throw e;
      }
      await this.provider.stopFlow(this.run.publicKey.toString());
      await this.provider.waitForFlowFinish(this.run.publicKey.toString());
    } else if (this.market) {
      this.logger.log(chalk.cyan('Leaving market queue'), true);
      try {
        const tx = await this.sdk.jobs.stop(this.market.address);
        this.logger.succeed(`Market queue successfully left with tx ${tx}`);
      } catch (e: any) {
        this.logger.fail(chalk.red.bold('Could not quit market queue'));
        throw e;
      }
    }
  }
  public static isRunExpired(run: Run, expireTime: number): Boolean {
    const now = Date.now() / 1000;
    // @ts-expect-error Type is wrong, its not a number but a BN
    return run.account.time.toNumber() + expireTime < now;
  }
}
