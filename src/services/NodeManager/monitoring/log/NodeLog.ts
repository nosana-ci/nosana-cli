import chalk from 'chalk';
import { logEmitter, LogEntry } from '../proxy/loggingProxy.js';
import { SECONDS_PER_DAY } from '../../../../generic/utils.js';

export interface LogObserver {
  update(log: NodeLogEntry): void;
}

export const log = (() => {
  let instance: NodeLog | null = null;

  return () => {
    if (!instance) {
      instance = new NodeLog();
    }
    return instance;
  };
})();

export interface NodeLogEntryPending {
  isPending: boolean;
  expecting: string | undefined;
}

export interface NodeLogEntry {
  log: string;
  method: string;
  type: string; // success, error, info, process, stop, log, update, process-bar, add, kill
  pending?: NodeLogEntryPending;
  timestamp: number;
  job: string | undefined;
  payload?: any;
}

class NodeLog {
  private observers: LogObserver[] = [];
  private shared: { [key: string]: string | boolean } = {};
  private job: string | undefined;

  constructor() {
    logEmitter.on('log', (data) => this.process(data));
  }

  public addObserver(observer: LogObserver) {
    this.observers.push(observer);
  }

  public removeObserver(observer: LogObserver) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  private notifyObservers(log: NodeLogEntry) {
    for (const observer of this.observers) {
      observer.update(log);
    }
  }

  private addLog(log: NodeLogEntry) {
    this.notifyObservers(log);
  }

  private process(data: LogEntry) {
    if (
      data.class === 'PodmanContainerOrchestration' ||
      data.class === 'DockerContainerOrchestration'
    ) {
      const provider =
        data.class === 'PodmanContainerOrchestration' ? 'podman' : 'docker';

      if (data.method === 'getConnection' && data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: `Provider:\t${chalk.greenBright.bold(provider)}`, // Changed 'g' to 'G', 'b' to 'B'
          timestamp: Date.now(),
          type: 'info',
          pending: { isPending: false, expecting: '' },
        });
      }

      if (data.method === 'healthy') {
        this.handleHealthy(data, provider);
      }

      if (data.method === 'pullImage') {
        this.handlePullImage(data);
      }

      if (data.method === 'createNetwork') {
        this.handleCreateNetwork(data);
      }

      if (data.method === 'runContainer') {
        this.handleRunContainer(data);
      }

      if (data.method === 'runFlowContainer') {
        this.handleRunFlowContainer(data);
      }

      if (data.method === 'check') {
        this.handleContainerCheckHandler(data, provider);
      }
    }

    if (data.class === 'ApiHandler') {
      this.handleApiHandler(data);
    }

    if (data.class === 'MarketHandler') {
      this.handleMarketHandler(data);
    }

    if (data.class === 'BasicNode' && data.method === 'pending') {
      this.handlePending(data);
    }

    if (data.class === 'BasicNode' && data.method === 'stop') {
      this.handleStop(data);
    }

    if (data.class === 'BasicNode' && data.method === 'exit') {
      this.handleExit(data);
    }

    if (
      data.class === 'BasicNode' &&
      (data.method === 'restartDelay' || data.method === 'delay')
    ) {
      this.handleRestart(data);
    }

    if (data.class === 'BasicNode' && data.method === 'benchmark') {
      this.handleBenchmark(data);
    }

    if (data.class === 'BasicNode' && data.method === 'recommend') {
      this.handleRecommend(data);
    }

    if (data.class === 'BasicNode' && data.method === 'queue') {
      this.handleQueue(data);
    }

    if (data.class === 'JobHandler') {
      this.handleJobHandler(data);
    }

    if (data.class === 'FlowHandler') {
      this.handleFlowHandler(data);
    }

    if (data.class === 'JobExternalUtil') {
      this.handleJobExternalUtil(data);
    }

    if (data.class === 'NodeRepository') {
      this.handleNodeRepository(data);
    }

    if (data.class === 'Provider') {
      this.handleProvider(data);
    }

    if (data.class === 'HealthHandler') {
      this.handleHealthHandler(data);
    }

    if (data.class === 'StakeHandler') {
      this.handleStakeHandler(data);
    }

    if (data.class === 'MultiProgressBarReporter') {
      if (data.method === 'start' && data.type == 'call') {
        // log that the info of the start
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(data.arguments[0]),
          timestamp: Date.now(),
          type: 'stop',
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'multi-process-bar-start',
          log: '', // Remains empty, no first letter to capitalize
          payload: {
            optProgressBar: data.arguments[1],
          },
        });
      }

      if (data.method === 'update' && data.type == 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'multi-process-bar-update',
          log: '', // Remains empty
          payload: {
            event: data.arguments[0],
          },
        });
      }

      if (data.method === 'stop' && data.type == 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'multi-process-bar-stop',
          log: '', // Remains empty
        });
      }
    }

    if (data.class === 'ProgressBarReporter') {
      if (data.method === 'start' && data.type == 'call') {
        // log that the info of the start
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(data.arguments[0]),
          timestamp: Date.now(),
          type: 'info',
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'process-bar-start',
          log: '', // Remains empty
          payload: {
            optProgressBar: data.arguments[1],
            total: data.arguments[2],
            startValue: data.arguments[3],
            payload: data.arguments[4],
            progressBarPreset: data.arguments[5],
          },
        });
      }

      if (data.method === 'update' && data.type == 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'process-bar-update',
          log: '', // Remains empty
          payload: {
            current: data.arguments[0],
            payload: data.arguments[1],
          },
        });
      }

      if (data.method === 'stop' && data.type == 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'process-bar-stop',
          log: '', // Remains empty
        });

        // log that the info of the start
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(data.arguments[0]),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }

    if (data.class === 'ExpiryHandler') {
      this.handleExpiryHandler(data);
    }

    if (data.class === 'ResourceManager') {
      this.handleResourceManager(data);
    }
  }

  private handleRecommend(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan('Grid is recommending market for node'),
        timestamp: Date.now(),
        type: 'info',
      });
    }
    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.green(
          `Grid recommended ${chalk.bold(
            data.result,
          )} market to node successfully`,
        ),
        timestamp: Date.now(),
        type: 'success',
      });
    }
    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red('Error recommended market to node'),
        timestamp: Date.now(),
        type: 'error',
      });
    }
  }

  private handleResourceManager(data: LogEntry) {
    if (data.method === 'fetchMarketRequiredResources') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan('Fetching market required resources'),
          timestamp: Date.now(),
          type: 'info',
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green('Fetching market required resources successful'),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red('Fetching market required resources failed'),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'getResourceVolumes') {
      if (data.type === 'call') {
        let urls = data.arguments[0]
          .map((item: { url: any }) => item.url)
          .filter((url: any) => url)
          .join(', ');

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Downloading resource ${urls}`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
      if (data.type === 'return') {
        let urls = data.arguments[0]
          .map((item: { url: any }) => item.url)
          .filter((url: any) => url)
          .join(', ');

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Downloaded resource ${urls}`),
          timestamp: Date.now(),
          type: 'success',
        });
      }
      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`${data.error}`),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }
  }
  
  private handleQueue(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Joining market ${data.arguments[0]}`),
        timestamp: Date.now(),
        // type: 'info',
        type: 'process',
        pending: {
          isPending: true,
          expecting: `${data.class}.${data.method}`,
        },
      });
    }
  }

  private handleBenchmark(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan('Benchmark is running'),
        timestamp: Date.now(),
        // type: 'info',
        type: 'process',
        pending: {
          isPending: true,
          expecting: `${data.class}.${data.method}`,
        },
      });
    }
    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.green('Benchmark completed successfully'),
        timestamp: Date.now(),
        type: 'success',
      });
    }
    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red('Benchmark failed'),
        timestamp: Date.now(),
        type: 'error',
      });
    }
  }

  private handleExpiryHandler(data: LogEntry) {
    if (data.method === 'init') {
      if (data.type === 'return') {
        this.shared.expiry = data.result;
      }
    }

    if (data.method === 'waitUntilExpired') {
      if (data.type === 'call') {
        if (this.shared.exposed) {
          const date = new Date(parseInt(this.shared.expiry as string));
          const dateString = date.toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });

          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.cyanBright(
              `Waiting for job ${chalk.bold(this.job)} to finish (${chalk.bold(
                dateString,
              )})`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        } else {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.cyanBright(
              `Waiting for job ${chalk.bold(this.job)} to finish`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        }
      }

      // if (data.type === 'return' || data.type === 'error') {
      //   this.addLog({
      //     method: `${data.class}.${data.method}`,
      //     job: this.job,
      //     log: chalk.green(`Job run time finished`),
      //     timestamp: Date.now(),
      //     type: data.type == 'return' ? 'success' : 'error',
      //   });
      // }
    }
  }

  private handleContainerCheckHandler(data: LogEntry, provider: string) {
    if (data.type == 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.green(
          `${chalk.bold(provider)} is running at ${chalk.bold(data.result)}`,
        ),
        timestamp: Date.now(),
        type: 'info',
      });
    }
  }

  private handleStakeHandler(data: LogEntry) {
    if (data.method === 'getStakeAccount') {
      if (data.type == 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(
            `Stake found with ${chalk.bold(
              data.result.amount / 1e6,
            )} NOS staked with unstake duration of ${chalk.bold(
              data.result.duration / SECONDS_PER_DAY,
            )} days`,
          ),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }
  }

  private handleHealthHandler(data: LogEntry) {
    if (data.method === 'run') {
      if(data.type === 'call'){
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan('Running health check'),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });

      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green('Health check completed'),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Health check failed: ${data.error}`),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }
  }

  private handleProvider(data: LogEntry) {
    if (data.method === 'runOperation') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(
            `Running action ${chalk.bold(
              data.arguments[0],
            )}, for flow ${chalk.bold(
              data.arguments[1].id,
            )} operation ${chalk.bold(data.arguments[1].name)}`,
          ),
          timestamp: Date.now(),
          type: 'info',
        });
      }

      if (data.type === 'return') {
        if (data.result) {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.green(
              `Action ${chalk.bold(data.arguments[0])}, for flow ${chalk.bold(
                data.arguments[1].id,
              )} operation ${chalk.bold(data.arguments[1].name)} was completed`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        } else {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.red(
              `Action ${chalk.bold(data.arguments[0])}, for flow ${chalk.bold(
                data.arguments[1].id,
              )} operation ${chalk.bold(data.arguments[1].name)} failed`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        }
      }
    }
  }

  private handleNodeRepository(data: LogEntry) {
    if (data.method === 'displayLog') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: data.arguments[0],
          timestamp: Date.now(),
          type: 'log',
        });
      }
    }
  }

  private handleJobExternalUtil(data: LogEntry) {
    if (data.method === 'validate') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan('Validating job definition'),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        if (data.result) {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.green('Job definition validated successfully'),
            timestamp: Date.now(),
            type: 'success',
          });
        } else {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.red('Job definition validation failed'),
            timestamp: Date.now(),
            type: 'error',
          });
        }
      }
    }

    if (data.method === 'resolveJobDefinition') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan('Resolving job definition'),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green('Job definition retrived successfully'),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red('Job definition retrival failed'),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'resolveResult') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan('Resolving job results'),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green('Job results resolved successfully'),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red('Resolving job results failed'),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }
  }

  private handleHealthy(data: LogEntry, provider: string) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(
          `Checking if provider is healthy (${chalk.bold(provider)})`,
        ),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      const log = {
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(
          `Checking if provider is healthy (${chalk.bold(provider)})`,
        ),
        timestamp: Date.now(),
        type: 'process',
      };

      if (data.result.status) {
        log.log = chalk.green(`Provider is healthy (${chalk.bold(provider)})`);
        log.type = 'success';
      } else {
        log.log = chalk.red(
          `Provider is not healthy (${chalk.bold(provider)}): ${
            data.result.error
          }`,
        );
        log.type = 'error';
      }
      this.addLog(log);
    }
  }

  private handlePullImage(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Pulling image ${chalk.bold(data.arguments[0])}`),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        timestamp: Date.now(),
        type: data.result.status ? 'success' : 'error',
        log: data.result.status
          ? chalk.green(`Pulled image ${chalk.bold(data.arguments[0])}`)
          : chalk.red(`Error pulling image ${chalk.bold(data.arguments[0])}`),
      });
    }
  }

  private handleCreateNetwork(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Creating network ${chalk.bold(data.arguments[0])}`),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        timestamp: Date.now(),
        type: data.result.status ? 'success' : 'error',
        log: data.result.status
          ? chalk.green(`Created network ${chalk.bold(data.arguments[0])}`)
          : chalk.red(
              `Error creating network ${chalk.bold(data.arguments[0])}`,
            ),
      });
    }
  }

  private handleRunContainer(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(
          `Starting container ${chalk.bold(data.arguments[0].Image)}`,
        ),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        timestamp: Date.now(),
        type: data.result.status ? 'success' : 'error',
        log: data.result.status
          ? chalk.green(
              `Running container ${chalk.bold(data.arguments[0].Image)}`,
            )
          : chalk.red(
              `Error starting container ${chalk.bold(data.arguments[0].Image)}`,
            ),
      });
    }
  }

  private handleRunFlowContainer(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Starting container ${chalk.bold(data.arguments[0])}`),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        timestamp: Date.now(),
        type: data.result.status ? 'success' : 'error',
        log: data.result.status
          ? chalk.green(`Running container ${chalk.bold(data.arguments[0])}`)
          : chalk.red(
              `Error starting container ${chalk.bold(data.arguments[0])}`,
            ),
      });
    }
  }

  private handleApiHandler(data: LogEntry) {
    if (data.method === 'start' && data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan('Starting node api (https & ws)'),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.method === 'start' && data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(
          `Node api (https & ws) running at ${chalk.bold(data.result)}`,
        ),
        timestamp: Date.now(),
        type: 'success',
      });
    }

    if (data.method === 'start' && data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red('Could not start node api (https & ws)'),
        timestamp: Date.now(),
        type: 'error',
      });
    }
  }

  private handleMarketHandler(data: LogEntry) {
    if (
      data.method === 'processMarketQueuePosition' &&
      data.type === 'return'
    ) {
      if (data.arguments[1]) {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: '',
          timestamp: Date.now(),
          type: 'stop',
        });
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          log: chalk.yellow(
            `${chalk.bgYellow.bold(' QUEUED ')} In market ${chalk.bold(
              data.arguments[0].address,
            )} at position ${data.result.position}/${data.result.count}`,
          ),
          type: 'process',
          pending: { isPending: true, expecting: `JobHandler.claim` },
        });
      } else {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          log: chalk.yellow(
            `${chalk.bgYellow.bold(' QUEUED ')} In market ${chalk.bold(
              data.arguments[0].address,
            )} at position ${data.result.position}/${data.result.count}`,
          ),
          type: 'update',
        });
      }
    }

    if (data.method === 'join' && data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red.bold('Could not join market'),
        timestamp: Date.now(),
        type: 'error',
      });
    }

    if (data.method === 'check') {
      if (data.type === 'return') {
        this.shared.market = data.arguments[0];
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(
            `Market ${chalk.greenBright.bold(
              data.arguments[0],
            )} checked successfully`,
          ),
          timestamp: Date.now(),
          type: 'info',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `Could not retrieve market ${chalk.bold(data.arguments[0])}`,
          ),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }
  }

  private handleExit(data: LogEntry) {
    this.job = undefined;
    this.shared = {};
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan('Shutting down node'),
        timestamp: Date.now(),
        type: 'kill-process',
      });
    }
  }

  private handleStop(data: LogEntry) {
    // if (data.type === 'call') {
    //   this.addLog({
    //     method: `${data.class}.${data.method}`,
    //     job: this.job,
    //     log: chalk.cyan('Shutting down node'),
    //     timestamp: Date.now(),
    //     type: 'process',
    //     pending: { isPending: true, expecting: `${data.class}.${data.method}` },
    //   });
    // }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.greenBright('Node shutdown successfully'),
        timestamp: Date.now(),
        type: 'kill-success',
      });
    }

    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.redBright('Node shutdown failed'),
        timestamp: Date.now(),
        type: 'kill-error',
      });
    }
    this.job = undefined;
  }

  private handleRestart(data: LogEntry) {
    this.job = undefined;

    if (data.method === 'restartDelay') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.yellow(
            `${chalk.bgYellow.bold(' RESTARTING ')} In ${chalk.bold(
              data.arguments[0],
            )} seconds`,
          ),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });

        let count = data.arguments[0];
        const intervalId = setInterval(() => {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.yellow(
              `${chalk.bgYellow.bold(' RESTARTING ')} In ${chalk.bold(
                count,
              )} seconds`,
            ),
            timestamp: Date.now(),
            type: 'update',
          });

          count--;

          if (count === 0) {
            clearInterval(intervalId);
          }
        }, 1000);
      }

      if (data.type == 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.yellow('Node has restarted successfully'),
          timestamp: Date.now(),
          type: 'success',
        });
      }
    }
  }

  private handlePending(data: LogEntry) {
    // No changes needed since no text was present
  }

  private handleJobHandler(data: LogEntry) {
    if (data.method === 'exposed') {
      if (data.type === 'return') {
        if (data.result) {
          this.shared.exposed = true;
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.green(`Job ${chalk.bold(this.job)} is now exposed`),
            timestamp: Date.now(),
            type: 'info',
          });
        } else {
          this.shared.exposed = false;
        }
      }
    }

    if (data.method === 'claim') {
      if (data.type === 'call') {
        this.job = data.arguments[0];
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          timestamp: Date.now(),
          type: 'stop',
          log: chalk.green(
            `Node has found job ${chalk.bold(data.arguments[0])}`,
          ),
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(
            `Node is claiming job ${chalk.bold(data.arguments[0])}`,
          ),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(
            `Node has claimed job ${chalk.bold(data.arguments[0])}`,
          ),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Error claiming job ${chalk.bold(data.arguments[0])}`),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'expired') {
      if (data.type === 'return' && data.result) {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.yellow(`Job ${chalk.bold(this.job)} is already expired`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }

    if (data.method === 'start') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Job ${chalk.bold(this.job)} is starting`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Job ${chalk.bold(this.job)} started successfully`),
          timestamp: Date.now(),
          type: 'success',
        });
      }
      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Error starting job ${chalk.bold(this.job)}`),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'finish') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Job ${chalk.bold(this.job)} is finishing`),
          timestamp: Date.now(),
          type: 'info',
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Job ${chalk.bold(this.job)} finished successfully`),
          timestamp: Date.now(),
          type: 'success',
        });
        this.job = undefined;
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Error finishing job ${chalk.bold(this.job)}`),
          timestamp: Date.now(),
          type: 'error',
        });
        this.job = undefined;
      }
    }

    if (data.method === 'runWithErrorHandling') {
      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Error occured running job ${chalk.bold(this.job)}`),
          timestamp: Date.now(),
          type: 'error',
        });
        this.job = undefined;
      }
    }
  }

  private handleFlowHandler(data: LogEntry) {
    if (data.method === 'init') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(
            `Flow ${chalk.bold(data.arguments[0])} is intializing`,
          ),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(
            `Flow ${chalk.bold(data.arguments[0])} is initialized`,
          ),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `Flow ${chalk.bold(data.arguments[0])} failed to initialized`,
          ),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'start') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Flow ${chalk.bold(data.arguments[0])} is starting`),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Flow ${chalk.bold(data.arguments[0])} started`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `Flow ${chalk.bold(data.arguments[0])} failed to start`,
          ),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'resume') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Flow ${chalk.bold(data.arguments[0])} is resuming`),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });
      }

      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Flow ${chalk.bold(data.arguments[0])} resumed`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `Flow ${chalk.bold(data.arguments[0])} failed to resume`,
          ),
          timestamp: Date.now(),
          type: 'error',
        });
      }
    }

    if (data.method === 'run') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`Flow ${chalk.bold(data.arguments[0])} is running`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }

    if (data.method === 'operationExposed') {
      if (data.type === 'return') {
        this.shared.exposed = true;
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(
            `Job ${chalk.bold(this.job)} is now exposed (${chalk.bold(
              data.result,
            )})`,
          ),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }
  }
}
