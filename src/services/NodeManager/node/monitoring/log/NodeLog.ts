import chalk, { ChalkInstance } from 'chalk';
import ora, { Ora } from 'ora';
import { logEmitter, LogEntry } from '../proxy/loggingProxy.js';

export interface LogObserver {
  update(job: string, log: string, timestamp: number): void;
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

class NodeLog {
  private observers: LogObserver[] = [];
  private shared: { [key: string]: string } = {};

  constructor() {
    logEmitter.on('log', (data) => this.process(data));
  }

  public addObserver(observer: LogObserver) {
    this.observers.push(observer);
  }

  public removeObserver(observer: LogObserver) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  private notifyObservers(job: string, log: string, timestamp: number) {
    for (const observer of this.observers) {
      observer.update(job, log, timestamp);
    }
  }

  addLog(log: string) {
    this.notifyObservers(this.shared.job, log, Date.now());
  }

  process(data: LogEntry) {
    if (
      data.class === 'PodmanContainerOrchestration' ||
      data.class === 'DockerContainerOrchestration'
    ) {
      let provider =
        data.class === 'PodmanContainerOrchestration' ? 'podman' : 'docker';
      if (data.method === 'getConnection' && data.type === 'call') {
        this.addLog(`Provider:\t${chalk.greenBright.bold(provider)}`);
      }

      if (data.method === 'healthy') {
        if (data.type === 'call') {
          this.addLog(
            chalk.cyan(
              `checking if provider is healthy (${chalk.bold(provider)})`,
            ),
          );
        }
        if (data.type === 'return') {
          if (data.result.status) {
            this.addLog(
              chalk.green(`provider is healthy (${chalk.bold(provider)})`),
            );
          } else {
            this.addLog(
              chalk.red(
                `provider is not healthy (${chalk.bold(provider)}): ${
                  data.result.error
                }`,
              ),
            );
          }
        }
      }
    }

    if (data.class === 'BasicNode') {
      if (data.method === 'start') {
        // if(data.type === 'call'){
        //     this.addLog(chalk.cyan('starting node'))
        // }
        if (data.type === 'return') {
          this.addLog(chalk.green('started node successfully'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.red(`failed to start node: ${data.error}`));
        }
      }

      if (data.method === 'healthcheck') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('starting healthcheck'));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green('healthcheck passed successfully'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.green('healthcheck failed'));
        }
      }

      if (data.method === 'benchmark') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('starting benchmark'));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green('benchmark passed successfully'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.green('benchmark failed'));
        }
      }

      if (data.method === 'pending') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('checking for pending job'));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green('no pending job found'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.red('pending job processing encountered error'));
        }
      }

      if (data.method === 'queue') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('node is attempting to queue in market'));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green('node entered marke queue'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.red('node failed to enter market queue'));
        }
      }

      if (data.method === 'run') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('node is listening for run'));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green('node has finished run'));
        }
        if (data.type === 'error') {
          this.addLog(chalk.red('error occured on node run'));
        }
      }

      if (data.method === 'stop') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan('stopping node'));
        }

        if (data.type === 'return') {
          this.addLog(chalk.green('node has been stopped'));
        }

        if (data.type === 'error') {
          this.addLog(chalk.red('node stop failed'));
        }
      }

      if (data.method === 'restartDelay') {
        if (data.type === 'call') {
          this.addLog(
            chalk.cyan(`node will restart in ${data.arguments[0]} seconds`),
          );
        }

        if (data.type === 'return') {
          this.addLog(chalk.green('node has been restarted'));
        }
      }
    }

    if (data.class === 'JobHandler') {
      if (data.method === 'claim') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan(`node is claiming job ${data.arguments[0]}`));
        }
        if (data.type === 'return') {
          this.addLog(chalk.green(`node has claimed job ${data.arguments[0]}`));
        }
        if (data.type === 'error') {
          this.addLog(chalk.red(`error claiming job ${data.arguments[0]}`));
        }
      }
      if (data.method === 'start') {
      }
      if (data.method === 'run') {
      }
      if (data.method === 'wait') {
      }
      if (data.method === 'idle') {
      }
      if (data.method === 'finish') {
      }
      if (data.method === 'isJobExpired') {
      }
    }

    if (data.class === 'FlowHandler') {
      if (data.method === 'loadJobDefinition') {
        if (data.type === 'call') {
          this.addLog(
            chalk.cyan(
              `node is downloading job defination ${data.arguments[0]}`,
            ),
          );
        }
        if (data.type === 'return') {
          this.addLog(
            chalk.green(
              `node has downloaded job defination ${data.arguments[0]}`,
            ),
          );
        }
        if (data.type === 'error') {
          this.addLog(
            chalk.red(`error downloading job defination${data.arguments[0]}`),
          );
        }
      }

      if (data.method === 'flowLogs') {
        if (data.type === 'call') {
          this.addLog(chalk.cyan(`${data.arguments[0]}`));
        }
      }
    }

    if (data.class === 'MarketHandler') {
      if (data.method === 'processMarketQueuePosition') {
        if (data.type === 'return') {
          this.addLog(
            chalk.green(
              `node is in queue position ${data.result.position}/${data.result.count}`,
            ),
          );
        }
      }
    }
  }
}
