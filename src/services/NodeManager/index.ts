import { ApiHandler } from './node/api/ApiHandler.js';
import { BasicNode } from './node/Node.js';
import { createLoggingProxy } from './monitoring/proxy/loggingProxy.js';
import { state } from './monitoring/state/NodeState.js';
import { stateStreaming } from './monitoring/streaming/StateStreamer.js';
import { log } from './monitoring/log/NodeLog.js';
import { logStreaming } from './monitoring/streaming/LogStreamer.js';
import { consoleLogging } from './monitoring/log/console/ConsoleLogger.js';
import { validateCLIVersion } from '../versions.js';

export default class NodeManager {
  private node: BasicNode;
  private apiHandler: ApiHandler;
  private exiting = false;
  public inJobLoop = false;

  constructor(options: { [key: string]: any }) {
    this.node = createLoggingProxy(new BasicNode(options));

    /**
     * the node class makes the api but we pass the api to the NodeManager class
     * because we want the api to be independent from nodes restarts
     */
    this.apiHandler = this.node.api();

    this.handleProcessExit();
  }

  async init(): Promise<void> {
    /**
     * setup state that any instance can listen to, state produced from the node via logging proxies.
     * set up node state processing, observers can connect to it and received state
     * updates of the node.
     */
    state(this.node.node());

    /**
     * this is one of the subscriber to @function state(),
     * this sends states over websockets to the job poster or external services
     */
    stateStreaming(this.node.node());

    /**
     * set up log listening, any instance can listen to log produces from the node
     * the logs are produces from the log proxy
     */
    log();

    /**
     * this is one of the subscriber to @function log(),
     * the send the log over websocket to job poster or any external service
     */
    logStreaming(this.node.node());

    /**
     * this is one of the subscriber to @function log()
     * this prints the logs to the console.
     */
    consoleLogging();

    /**
     * start
     *
     * this includes setting up everything in the node including
     * the node api, initializing everything that needs to be initialized
     */
    await this.node.start();

    if (!this.node.isOnboarded) {
      await this.node.register();
    }

    /**
     * start the api of the node and register all the routes of the nodes,
     * we call this here in the init so the api survives restarts between jobs
     */
    await this.apiHandler.start();
  }

  async start(market?: string): Promise<void> {
    this.exiting = false;

    if (this.inJobLoop) {
      await validateCLIVersion();
    }

    /**
     * maintaniance
     */
    await this.node.maintaniance();

    /**
     * grid
     *
     * if no market was supplied, we will register on the grid and get
     * market and access key recommened for our PC based on benchmark result
     */
    if (!market) {
      if (!(await this.node.benchmark())) {
        /**
         * start
         *
         * recursively start the the process again by calling the restart function
         */
        return await this.restart(market);
      }

      market = await this.node.recommend();
    } else {
      /**
       * benchmark
       *
       * this benchmarks the node to ensure it can run the jobs.
       * It gets the GPUs, CPUs, and internet speed.
       *
       * if the benchmark fails restart the system
       */
      if (!(await this.node.benchmark())) {
        /**
         * start
         *
         * recursively start the the process again by calling the restart function
         */
        return await this.restart(market);
      }
    }

    /**
     * setup
     *
     * this sets up everything need, downloads needed resources ...
     */
    await this.node.setup(market);

    // TODO: health check
    /**
     * healthcheck
     *
     * this checks the health of the container tech,
     * the connectivity, and every other critical system.
     */
    if (!(await this.node.healthcheck(market))) {
      /**
       * start
       *
       * recursively start the the process again by calling the restart function
       */
      return await this.restart(market);
    }

    /**
     * this variable was added to know when the node has gone past the setup/checks stages
     * and is now starting job work and queueing,
     * this is mainly put that we want to report error and end the node only when it hasn't passed
     * these stages else we want to restart the node process on error
     */
    this.inJobLoop = true;

    /**
     * pending
     *
     * This checks for pending jobs that were assigned to the node.
     * If the node was shut down and did not pick up a job,
     * this runs the job and returns a boolean indicating whether
     * there was a job or not.
     *
     * NT: If there was a pending job and it has done it, the process
     * needs to be restarted.
     */
    if (await this.node.pending()) {
      /**
       * start
       *
       * recursively start the the process again by calling the restart function
       */
      return await this.restart(market);
    }

    /**
     * queue
     *
     * Enter the queue to wait for a job since we have no pending jobs.
     */
    await this.node.queue(market);

    /**
     * run
     *
     * This listens to the queue and immediately starts a job when received.
     * Once the job finishes, the process needs to be restarted.
     *
     * NT: If the run doesn't get a job immediately, the process will wait.
     */
    await this.node.run();

    /**
     * start
     *
     * recursively start the the process again by calling the restart function
     */
    return await this.restart(market);
  }

  async stop() {
    this.exiting = true;

    try {
      /**
       * stop api
       *
       * we want to stop the api server, we only do this on complete shutdown and not
       * restarts after jobs
       */
      await this.apiHandler.stop();
    } catch (error) {}

    /**
     * check if the node exists then stop the node, this will involve killing and cleaning
     * the processes.
     */
    if (this.node) {
      await this.node.stop();
    }

    state(this.node.node()).clear();
    stateStreaming(this.node.node()).clear();
    logStreaming(this.node.node()).clear();

    this.exiting = false;
  }

  async restart(market?: string) {
    if (this.exiting) return;
    this.exiting = true;
    this.node.exit();

    /**
     * stop
     *
     * stop the node, clear up data, close processes and operations
     */
    await this.node.stop();

    /**
     * delay
     *
     * put a delay of seconds to space out restarting
     */
    await this.node.restartDelay(10);

    /**
     * start
     *
     * start the process of this manager
     */
    await this.start(market);
  }

  async delay(sec: number) {
    await this.node.restartDelay(sec);
  }

  async error() {
    if (this.exiting) return;
    this.exiting = true;
    this.node.exit();
  }

  /**
   * Set up handling for process exit signals
   */
  private handleProcessExit() {
    const exitHandler = async () => {
      if (this.exiting) return;
      this.exiting = true;
      this.node.exit();

      /**
       * this just concludes the job (finishes the job) so the node gets paid
       * this is to only be used in voluntry exit of the node
       * ? error loop? when the user can't conculde this and it throws error and keeps restarting?
       */
      try {
        await this.node.conclude();
      } catch (error) {
        console.log(`Job Finishing Failed${error}`);
      }

      await this.stop();
      process.exit();
    };

    process.on('SIGINT', exitHandler); // Handle Ctrl+C
    process.on('SIGTERM', exitHandler); // Handle termination signals
  }
}
