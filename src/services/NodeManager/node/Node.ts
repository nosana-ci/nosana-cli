import { getSDK } from '../../sdk.js';
import { MarketHandler } from './market/marketHandler.js';
import { Client, Market, Run } from '@nosana/sdk';
import { RunHandler } from './run/runHandler.js';
import { PublicKey } from '@solana/web3.js';
import { JobHandler } from './job/jobHandler.js';
import { DB } from '../../../providers/modules/db/index.js';
import { ContainerOrchestrationInterface, selectContainerOrchestrationProvider } from '../provider/containerOrchestration/interface.js';
import {
  createResourceManager,
  ResourceManager,
} from '../../../providers/modules/resourceManager/index.js';
import { Provider } from '../provider/Provider.js';
import Logger from '../../../providers/modules/logger/index.js';
import {
  applyLoggingProxyToClass,
} from './monitoring/proxy/loggingProxy.js';
import { sleep } from '../../../generic/utils.js';
import { ApiHandler } from './api/ApiHandler.js';
import { NodeRepository } from "../repository/NodeRepository.js";
import { BenchmarkHandler, GridData } from "./benchmark/benchmarkHandler.js";

export class BasicNode {
  private apiHandler: ApiHandler;
  private runHandler: RunHandler;
  private marketHandler: MarketHandler;
  private jobHandler: JobHandler;
  private benchmarkHandler: BenchmarkHandler;
  private repository: NodeRepository;
  private resourceManager: ResourceManager;
  private provider: Provider;
  private containerOrchestration: ContainerOrchestrationInterface;

  private sdk: Client;
  constructor(options: {
    provider: string;
    url: string;
    config: string;
    port: number;
  }) {
    this.sdk = getSDK();

    const db = new DB(options.config).db;
    this.repository = new NodeRepository(db)
    this.containerOrchestration = selectContainerOrchestrationProvider(options.provider, options.url);
    this.resourceManager = createResourceManager(
      db,
      this.containerOrchestration.getConnection(),
      new Logger(),
    );
    this.provider = new Provider(
      this.containerOrchestration,
      this.repository,
      this.resourceManager,
    );

    this.apiHandler = new ApiHandler(this.sdk, this.repository, this.provider, options.port);
    this.benchmarkHandler = new BenchmarkHandler(this.sdk, this.provider, this.repository)
    this.jobHandler = new JobHandler(this.sdk, this.provider, this.repository);
    this.marketHandler = new MarketHandler(this.sdk);
    this.runHandler = new RunHandler(this.sdk);

    applyLoggingProxyToClass(this);
  }

  async healthcheck(): Promise<boolean> {
    return true;
  }
  
  async benchmark(): Promise<boolean> {
    /**
     * check the gpus using a premade job definition
     * this is what we do before every job runs
     */
    return await this.benchmarkHandler.check()
  }

  async grid(): Promise<GridData> {
    /**
     * we are using this benchmark to get the market and access key meant for
     * the node
     * we can run this on every job if the market is not provided
     */
    return await this.benchmarkHandler.grid()
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
  }

  async start(): Promise<void> {
    /**
     * get an instance to the container 
     */
    await this.containerOrchestration.getConnection()
    
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

  async run(): Promise<void> {
    await new Promise<void>(async (resolve) => {
      await this.runHandler.startRunMonitoring(async (run: Run) => {
        /**
         * once we have found a run in the queue we want to stop this run monitoring
         */
        this.runHandler.stopRunMonitoring();

        /**
         * once we have found a run in the run we want to stop this market queue monitoring,
         * because this can come earlier than the market queue.
         */
        this.marketHandler.stopMarketQueueMonitoring();

        const jobAddress = run.account.job.toString();

        /**
         * get the current market the market queue was in before this
         * run/job was assigned to the node.
         */
        const market = this.marketHandler.getMarket() as Market;

        /**
         * claim the job by polling the job and setting it in the job handler
         * as the current job for this cycle
         */
        const job = await this.jobHandler.claim(jobAddress);

        /**
         * check if the job is expired if it is quit the job,
         * if not continue to start
         */
        if((await this.jobHandler.expired(market, run))){
          return await this.jobHandler.quit(run);
        }

        /**
         * Start the job, this includes downloading the job defination, starting the flow
         * checking if flow is existing, if the job fails to start we quit the job
         */
        if (!(await this.jobHandler.start(job))) {
          return await this.jobHandler.quit(run);
        }

        /**
         * actually run the flow if the job and carry out the task, using the flow handler
         * and the providers
         */
        await this.jobHandler.run();

        /**
         * wait for the job to finish or reach it expiry time, so if the job is a long runnning
         * or exposed job, the wait will allow it run it's course or if not it will finish when
         * processing is done
         */
        await this.jobHandler.wait(run, market);

        /**
         * upload the result and end the flow, also clean up flow.
         */
        await this.jobHandler.finish(run);

        resolve();
      });
    });
  }

  async pending(): Promise<boolean> {
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
      const market = await this.marketHandler.setMarket(job.market.toString());


      /**
       * check if the job is expired if it is quit the job,
       * if not continue to start
       */
      if((await this.jobHandler.expired(market, run))){
        await this.jobHandler.quit(run);
        return true;
      }

      /**
       * Start the job, this includes downloading the job defination, starting the flow
       * checking if flow is existing, if the job fails to start we quit the job
       * and return true, this will cause the application to restart as it just finished a job
       */
      if (!(await this.jobHandler.start(job))) {
        await this.jobHandler.quit(run);
        return true;
      }

      /**
       * actually run the flow if the job and carry out the task, using the flow handler
       * and the providers
       */
      await this.jobHandler.run();

      /**
       * wait for the job to finish or reach it expiry time, so if the job is a long runnning
       * or exposed job, the wait will allow it run it's course or if not it will finish when
       * processing is done
       */
      await this.jobHandler.wait(run, market);

      /**
       * upload the result and end the flow, also clean up flow.
       */
      await this.jobHandler.finish(run);

      return true;
    }
    return false;
  }

  async queue(market?: string, accessKey?: PublicKey): Promise<void> {
    /**
     * check if market was specified and if it wasnt select market from list
     */
    if (!market) {
      throw new Error(
        'market is not specified, TODO: market will be recommended',
      );
    }

    /**
     * set the market that will be all through the marketHandler for
     * the rest of this cycle until this job is finished
     */
    await this.marketHandler.setMarket(market);

    /**
     * check if the node is already queued in a market and if not
     * this node will join the market, or skip if it is already joined
     */
    let joinedMarket = await this.marketHandler.checkQueuedInMarket();
    if (!joinedMarket) {
      joinedMarket = await this.marketHandler.join(accessKey);
    }

    /**
     * check queue position of node in market
     */
    this.marketHandler.processMarketQueuePosition(joinedMarket);

    /**
     * here we listen to the market queue and listen to any chnages
     * here we can use it to log or get info, but not run job because
     * it is not a blocking process
     */
    this.marketHandler.startMarketQueueMonitoring(
      (market: Market | undefined) => {
        if (!market) {
          /**
           * once we have found a job in the market we want to stop this queue monitoring
           */
          this.marketHandler.stopMarketQueueMonitoring();
        } else {
          /**
           * update the market position on queue
           */
          this.marketHandler.processMarketQueuePosition(market);
        }
      },
    );
  }

  public async restartDelay(time: number) {
    for (let timer = time; timer > 0; timer--) {
      await sleep(1);
    }
  }
}
