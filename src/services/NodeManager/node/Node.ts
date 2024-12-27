import { Client, Market, Run } from '@nosana/sdk';

import { getSDK } from '../../sdk.js';
import { MarketHandler } from './market/marketHandler.js';
import { RunHandler } from './run/runHandler.js';
import { JobHandler } from './job/jobHandler.js';
import { DB } from '../../../providers/modules/db/index.js';
import { ContainerOrchestrationInterface } from '../provider/containerOrchestration/interface.js';
import { Provider } from '../provider/Provider.js';
import { applyLoggingProxyToClass } from '../monitoring/proxy/loggingProxy.js';
import { sleep } from '../../../generic/utils.js';
import { ApiHandler } from './api/ApiHandler.js';
import { NodeRepository } from '../repository/NodeRepository.js';
import { BenchmarkHandler } from './benchmark/benchmarkHandler.js';
import { HealthHandler } from './health/healthHandler.js';
import { KeyHandler } from './key/keyHandler.js';
import { ExpiryHandler } from './expiry/expiryHandler.js';
import { GridHandler } from './grid/gridHandler.js';
import { ResourceManager } from './resource/resourceManager.js';
import { selectContainerOrchestrationProvider } from '../provider/containerOrchestration/selectContainerOrchestration.js';

export class BasicNode {
  private apiHandler: ApiHandler;
  private runHandler: RunHandler;
  private marketHandler: MarketHandler;
  private jobHandler: JobHandler;
  private benchmarkHandler: BenchmarkHandler;
  private keyHandler: KeyHandler;
  private healthHandler: HealthHandler;
  private expiryHandler: ExpiryHandler;
  private gridHandler: GridHandler;
  private repository: NodeRepository;
  private resourceManager: ResourceManager;
  private provider: Provider;
  private containerOrchestration: ContainerOrchestrationInterface;
  private exiting = false;

  private sdk: Client;
  constructor(options: { [key: string]: any }) {
    this.sdk = getSDK();

    const db = new DB(options.config).db;
    this.repository = new NodeRepository(db);
    this.containerOrchestration = selectContainerOrchestrationProvider(
      options.provider,
      options.podman,
      options.gpu,
    );
    this.resourceManager = new ResourceManager(
      this.containerOrchestration,
      this.repository,
    );

    this.provider = new Provider(
      this.containerOrchestration,
      this.repository,
      this.resourceManager,
    );

    this.apiHandler = new ApiHandler(
      this.sdk,
      this.repository,
      this.provider,
      options.port,
    );
    this.gridHandler = new GridHandler(this.sdk, this.repository);
    this.benchmarkHandler = new BenchmarkHandler(
      this.sdk,
      this.provider,
      this.repository,
    );
    this.jobHandler = new JobHandler(this.sdk, this.provider, this.repository);
    this.marketHandler = new MarketHandler(this.sdk);
    this.runHandler = new RunHandler(this.sdk);
    this.keyHandler = new KeyHandler(this.sdk);

    this.healthHandler = new HealthHandler(
      this.sdk,
      this.containerOrchestration,
      this.marketHandler,
      this.keyHandler,
    );
    this.expiryHandler = new ExpiryHandler(this.sdk);

    applyLoggingProxyToClass(this);
  }

  async healthcheck(market: string): Promise<boolean> {
    /**
     * run health check,
     */
    return await this.healthHandler.run(market);
  }

  async benchmark(): Promise<boolean> {
    /**
     * check the gpus using a premade job definition
     * this is what we do before every job runs
     */
    return await this.benchmarkHandler.check();
  }

  async recommend(): Promise<string> {
    /**
     * we query the grid to find out if the node has already been onboarded
     * if it has been onboarded it might have been assigned/recommended a market
     * if it has not been onboarded quit the process
     */
    const nodeData = await this.gridHandler.getNodeStatus();
    if (nodeData.status !== 'onboarded') {
      throw new Error('Node not onboarded yet');
    }

    /**
     * this means even tho we have been onbaorded there might be no market assigned to us
     * or we need to check if we are still in the right market,
     * so we need to get a recommended one and return it
     */
    return await this.gridHandler.recommend();
  }

  public api(): ApiHandler {
    return this.apiHandler;
  }

  public node(): string {
    return this.sdk.solana.provider!.wallet.publicKey.toString();
  }

  async stop(): Promise<void> {
    await this.marketHandler.stop();
    await this.runHandler.stop();
    await this.jobHandler.stop();
    this.expiryHandler.stop();
  }

  async start(): Promise<void> {
    /**
     * get an instance to the container
     */
    await this.containerOrchestration.getConnection();

    /**
     * check if the container is fine and healthy
     */
    const { status, error } = await this.containerOrchestration.healthy();
    if (!status) {
      throw new Error(
        `error on container orchestration (docker or podman), error: ${error}`,
      );
    }
  }

  async setup(market: string): Promise<void> {
    await this.resourceManager.fetchMarketRequiredResources(market);
  }

  run(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const periodicHealthcheck = async (): Promise<boolean> => {
          const { status, error } = await this.containerOrchestration.healthy();
          if (!status) {
            return false
          }
          return true
        }

        const run = await this.runHandler.startRunMonitoring(periodicHealthcheck);

        /**
         * Once we have found a run in the queue, we want to stop this run monitoring
         */
        this.runHandler.stopRunMonitoring();

        /**
         * Once we have found a run in the run, we want to stop this market queue monitoring,
         * because this can come earlier than the market queue.
         */
        this.marketHandler.stopMarketQueueMonitoring();

        const jobAddress = run.account.job.toString();

        /**
         * Get the current market the market queue was in before this
         * run/job was assigned to the node.
         */
        const market = this.marketHandler.getMarket() as Market;

        /**
         * Claim the job by polling the job and setting it in the job handler
         * as the current job for this cycle.
         */
        const job = await this.jobHandler.claim(jobAddress);

        /**
         * Check if the job is expired. If it is, quit the job;
         * otherwise, continue to start.
         */
        if (!this.expiryHandler.expired(run, job)) {
          /**
           * This starts the expiry settings to monitor expiry time
           */
          this.expiryHandler.init<void>(
            run,
            job,
            jobAddress,
            async () => {
              try {
                /**
                 * upload the result and end the flow, also clean up flow.
                 */
                await this.jobHandler.finish(run);
              } catch (error) {
                reject(error);
              }

              resolve(); // Signal that the process should end
            },
          );

          /**
           * Start the job. This includes downloading the job definition, starting the flow,
           * checking if the flow exists, and quitting the job if it fails to start.
           */
          await this.jobHandler.start(job);

          /**
           * Run the flow asynchronously and handle errors via a Promise.
           * This lets us run the job in the background (async) and still get an error in this main process.
           */
          await this.jobHandler.runWithErrorHandling();

          /**
           * Wait for the job to expire before continuing if the setup was successful.
           */
          await this.expiryHandler.waitUntilExpired();
        }

        /**
         * Upload the result and end the flow; also clean up flow.
         */
        await this.jobHandler.finish(run);

        // Resolve the Promise normally
        resolve();
      } catch (error) {
        // Reject the Promise if any errors occur
        reject(error);
      }
    });
  }

  async pending(): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        /**
         * check if node has any run assigned to it and if not skip all
         * these process, if there is a run, proceed to run the job
         */
        const run = await this.runHandler.checkRun();

        if (run) {
          const jobAddress = run.account.job.toString();

          /**
           * claim the job by polling the job and setting it in the job handler
           * as the current job for this cycle
           */
          const job = await this.jobHandler.claim(jobAddress);

          /**
           * set the market of the job as the current market in this cycle
           */
          const market = await this.marketHandler.setMarket(
            job.market.toString(),
          );

          /**
           * check if the job is expired if it is quit the job,
           * if not continue to start
           */
          if (!this.expiryHandler.expired(run, job)) {
            /**
             * this starts the expiry settings to monitory expiry time
             */
            this.expiryHandler.init<void>(
              run,
              job,
              jobAddress,
              async () => {
                try {
                  /**
                   * upload the result and end the flow, also clean up flow.
                   */
                  await this.jobHandler.finish(run);
                } catch (error) {
                  reject(error);
                }

                resolve(true);
              },
            );

            /**
             * Start the job, this includes downloading the job defination, starting the flow
             * checking if flow is existing, if the job fails to start we quit the job
             * and return true, this will cause the application to restart as it just finished a job
             */
            await this.jobHandler.start(job);

            /**
             * Run the flow asynchronously and handle errors via a Promise
             * this lets us run the job in the background (async) and still get an error in this main
             */
            await this.jobHandler.runWithErrorHandling();

            /**
             * wait for the job to expire before continue if the setup was successful
             */
            await this.expiryHandler.waitUntilExpired();
          }

          /**
           * upload the result and end the flow, also clean up flow.
           */
          await this.jobHandler.finish(run);

          resolve(true);
        }
        resolve(false);
      } catch (error) {
        reject(error);
      }
    });
  }

  async queue(market?: string): Promise<void> {
    /**
     * check if market was specified and if it wasnt select market from list
     */
    if (!market) {
      throw new Error(
        'market is not specified, TODO: market will be recommended',
      );
    }

    /**
     * check if the node is already queued in a market and if not
     * this node will join the market, or skip if it is already joined
     */
    let joinedMarket = await this.marketHandler.checkQueuedInMarket();

    /**
     * set the market that will be all through the marketHandler for
     * the rest of this cycle until this job is finished
     */
    await this.marketHandler.setMarket(market);

    if (!joinedMarket) {
      joinedMarket = await this.marketHandler.join(
        this.keyHandler.getAccessKey(),
      );
    } else {
      this.marketHandler.setInMarket();
    }

    let firstMarketCheck = true;
    /**
     * here we listen to the market queue and listen to any chnages
     * here we can use it to log or get info, but not run job because
     * it is not a blocking process
     */
    this.marketHandler.startMarketQueueMonitoring(
      (market: Market | undefined) => {
        try {
          if (!market) {
            /**
             * once we have found a job in the market we want to stop this queue monitoring
             */
            this.marketHandler.stopMarketQueueMonitoring();
          } else {
            /**
             * update the market position on queue
             */
            this.marketHandler.processMarketQueuePosition(
              market,
              firstMarketCheck,
            );

            firstMarketCheck = false;
          }
        } catch (error) {}
      },
    );
  }

  public async maintaniance() {
    this.jobHandler.clearOldJobs();
  }

  public exit() {
    this.exiting = true;
  }

  public restartDelay(time: number): Promise<void> {
    return new Promise((resolve) => {
      let timer = time;

      const intervalId = setInterval(() => {
        timer--;

        if (timer <= 0) {
          clearInterval(intervalId);
          resolve();
        }
      }, 1000); // 1000 ms = 1 second
    });
  }
}
