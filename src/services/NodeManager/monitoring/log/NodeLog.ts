import chalk, { ChalkInstance } from 'chalk';
import ora, { Ora } from 'ora';
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
  type: string; // success, error, info, process, stop, log, update, add
  pending?: NodeLogEntryPending;
  timestamp: number;
  job: string | undefined;
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
          log: `Provider:\t${chalk.greenBright.bold(provider)}`,
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

    if (data.class === 'ExpiryHandler') {
      this.handleExpiryHandler(data);
    }
  }

  private handleRecommend(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Grid is recommending market for Node`),
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
          )} market to Node successfully`,
        ),
        timestamp: Date.now(),
        type: 'success',
      });
    }
    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red(`Error recommended market to Node`),
        timestamp: Date.now(),
        type: 'error',
      });
    }
  }

  private handleBenchmark(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`Benchmark is running`),
        timestamp: Date.now(),
        type: 'info',
      });
    }
    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.green(`Benchmark completed started successfully`),
        timestamp: Date.now(),
        type: 'success',
      });
    }
    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red(`Benchmark failed`),
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
              `Waiting for job ${chalk.bold(this.job)}  to finish`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        }
      }

      // if (data.type === 'return') {
      //   this.addLog({
      //     method: `${data.class}.${data.method}`,
      //     job: this.job,
      //     log: chalk.yellow(
      //       `job ${this.job} is now expired`,
      //     ),
      //     timestamp: Date.now(),
      //     type: 'info',
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
      if (data.type === 'return') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(`running health check`),
          timestamp: Date.now(),
          type: 'process',
          pending: {
            isPending: true,
            expecting: `${data.class}.${data.method}`,
          },
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`health check completed`),
          timestamp: Date.now(),
          type: 'success',
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: `Market:\t\t${chalk.greenBright.bold(data.arguments[0])}`,
          timestamp: Date.now(),
          type: 'stop',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`health check failed`),
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
            `running action ${chalk.bold(
              data.arguments[0],
            )}, for flow ${chalk.bold(
              data.arguments[1].id,
            )} operation ${chalk.bold(data.arguments[1].index)}`,
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
              `action ${chalk.bold(data.arguments[0])}, for flow ${chalk.bold(
                data.arguments[1].id,
              )} operation ${chalk.bold(
                data.arguments[1].index,
              )} was completed`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        } else {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.red(
              `action ${chalk.bold(data.arguments[0])}, for flow ${chalk.bold(
                data.arguments[1].id,
              )} operation ${chalk.bold(data.arguments[1].index)} failed`,
            ),
            timestamp: Date.now(),
            type: 'info',
          });
        }
      }
    }
  }

  private handleNodeRepository(data: LogEntry) {
    if (data.method === 'updateOpStateLogs') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: data.arguments[2],
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
          log: chalk.cyan(`validating job definition`),
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
            log: chalk.green(`job definition validated successfully`),
            timestamp: Date.now(),
            type: 'success',
          });
        } else {
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.red(`job definition validation failed`),
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
          log: chalk.cyan(`resolving job definition`),
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
          log: chalk.green(`job definition retrived successfully`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`job definition retrival failed`),
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
          log: chalk.cyan(`resolving job results`),
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
          log: chalk.green(`job results resolved successfully`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`resolving job results failed`),
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
          `checking if provider is healthy (${chalk.bold(provider)})`,
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
          `checking if provider is healthy (${chalk.bold(provider)})`,
        ),
        timestamp: Date.now(),
        type: 'process',
      };

      if (data.result.status) {
        log.log = chalk.green(`provider is healthy (${chalk.bold(provider)})`);
        log.type = 'success';
      } else {
        log.log = chalk.red(
          `provider is not healthy (${chalk.bold(provider)}): ${
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
        log: `${chalk.cyan(`pulling image ${chalk.bold(data.arguments[0])}`)}`,
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
          ? chalk.green(`pulled image ${chalk.bold(data.arguments[0])}`)
          : chalk.red(`error pulling image ${chalk.bold(data.arguments[0])}`),
      });
    }
  }

  private handleCreateNetwork(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: `${chalk.cyan(
          `creating network ${chalk.bold(data.arguments[0])}`,
        )}`,
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
          ? chalk.green(`created network ${chalk.bold(data.arguments[0])}`)
          : chalk.red(
              `error creating network ${chalk.bold(data.arguments[0])}`,
            ),
      });
    }
  }

  private handleRunContainer(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: `${chalk.cyan(
          `starting container ${chalk.bold(data.arguments[0])}`,
        )}`,
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
          ? chalk.green(`running container ${chalk.bold(data.arguments[0])}`)
          : chalk.red(
              `error starting container ${chalk.bold(data.arguments[0])}`,
            ),
      });
    }
  }

  private handleApiHandler(data: LogEntry) {
    if (data.method === 'start' && data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: `${chalk.cyan('Starting Node API (https & ws)')}`,
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
          `Node API (https & ws) running at ${chalk.bold(data.result)}`,
        ),
        timestamp: Date.now(),
        type: 'success',
      });
    }

    if (data.method === 'start' && data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.red('Could not start Node API (https & ws)'),
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
          timestamp: Date.now(),
          log: chalk.yellow(
            `${chalk.bgYellow.bold(' QUEUED ')} in market ${chalk.bold(
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
            `${chalk.bgYellow.bold(' QUEUED ')} in market ${chalk.bold(
              data.arguments[0].address,
            )} at position ${data.result.position}/${data.result.count}`,
          ),
          type: 'update',
        });
      }
    }

    if (data.method === 'join' && data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: `${chalk.cyan(
          `Joining market ${chalk.bold(this.shared.market)}`,
        )}`,
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.method === 'join' && data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.greenBright(
          `Joined market ${chalk.bold(this.shared.market)}`,
        ),
        timestamp: Date.now(),
        type: 'success',
      });
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
            `market ${chalk.greenBright.bold(
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

  private handleStop(data: LogEntry) {
    if (data.type === 'call') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.cyan(`shutting down node`),
        timestamp: Date.now(),
        type: 'process',
        pending: { isPending: true, expecting: `${data.class}.${data.method}` },
      });
    }

    if (data.type === 'return') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.greenBright(`node shutdown successfully`),
        timestamp: Date.now(),
        type: 'success',
      });
    }

    if (data.type === 'error') {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: chalk.redBright(`node shutdown failed`),
        timestamp: Date.now(),
        type: 'error',
      });
    }
  }

  private handleRestart(data: LogEntry) {
    if (data.method === 'restartDelay') {
      if (data.type === 'call') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: `${chalk.yellow(
            `Node is restarting in ${data.arguments[0]} seconds`,
          )}`,
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
            log: `${chalk.yellow(`Node is restarting in ${count} seconds`)}`,
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
          log: chalk.yellow(`node has restarted successfully`),
          timestamp: Date.now(),
          type: 'success',
        });
      }
    }
  }

  private handlePending(data: LogEntry) {
    if (data.type === 'return' && !data.result) {
      this.addLog({
        method: `${data.class}.${data.method}`,
        job: this.job,
        log: `${chalk.yellow('No pending job found')}`,
        timestamp: Date.now(),
        type: 'info',
      });
    }
  }

  private handleJobHandler(data: LogEntry) {
    if (data.method === 'exposed') {
      if (data.type === 'return') {
        if (data.result) {
          this.shared.exposed = true;
          this.addLog({
            method: `${data.class}.${data.method}`,
            job: this.job,
            log: chalk.green(`job ${chalk.bold(this.job)} is now exposed`),
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
            `node has found job ${chalk.bold(data.arguments[0])}`,
          ),
        });

        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.cyan(
            `node is claiming job ${chalk.bold(data.arguments[0])}`,
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
            `node has claimed job ${chalk.bold(data.arguments[0])}`,
          ),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`error claiming job ${chalk.bold(data.arguments[0])}`),
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
          type: 'info',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(`Error finishing job ${chalk.bold(this.job)}`),
          timestamp: Date.now(),
          type: 'info',
        });
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
            `flow ${chalk.bold(data.arguments[0])} is intializing`,
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
            `flow ${chalk.bold(data.arguments[0])} is initialized`,
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
            `flow ${chalk.bold(data.arguments[0])} failed to initialized`,
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
          log: chalk.cyan(`flow ${chalk.bold(data.arguments[0])} is starting`),
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
          log: chalk.green(`flow ${chalk.bold(data.arguments[0])} started`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `flow ${chalk.bold(data.arguments[0])} failed to start`,
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
          log: chalk.cyan(`flow ${chalk.bold(data.arguments[0])} is resuming`),
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
          log: chalk.green(`flow ${chalk.bold(data.arguments[0])} resumed`),
          timestamp: Date.now(),
          type: 'success',
        });
      }

      if (data.type === 'error') {
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.red(
            `flow ${chalk.bold(data.arguments[0])} failed to resume`,
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
          log: chalk.cyan(`flow ${chalk.bold(data.arguments[0])} is running`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }

    if(data.method === 'operationExposed'){
      if (data.type === 'return') {
        this.shared.exposed = true;
        this.addLog({
          method: `${data.class}.${data.method}`,
          job: this.job,
          log: chalk.green(`Job ${chalk.bold(this.job)} is now exposed (${chalk.bold(data.result)})`),
          timestamp: Date.now(),
          type: 'info',
        });
      }
    }
  }
}
