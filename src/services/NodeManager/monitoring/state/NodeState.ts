import { logEmitter, LogEntry } from '../proxy/loggingProxy.js';
import { classifyState } from './classifyState.js';

export interface StateObserver {
  update(
    status: string,
    state: { [key: string]: string },
    timestamp: number,
  ): void;
}

export const state = (() => {
  let instance: NodeState | null = null;

  return (node: string) => {
    if (!instance) {
      instance = new NodeState(node);
    }
    return instance;
  };
})();

export class NodeState {
  public shared: { [key: string]: string } = {};
  private info: { [key: string]: any } = {};

  private status: string = 'none';
  private state: { [key: string]: any } = {};
  private history: {
    status: string;
    state: { [key: string]: string };
    timestamp: number;
  }[] = [];
  private observers: StateObserver[] = [];

  constructor(node: string) {
    this.info = {
      node,
      uptime: new Date(),
    };
    this.shared = {
      node,
    };
    logEmitter.on('log', (data: LogEntry) => this.process(data));
  }

  public clear() {
    this.history = [];
    this.state = {};
    this.shared = {};
  }

  public getNodeInfo() {
    return {
      ...this.info,
      state: classifyState(this.status),
    };
  }

  public addObserver(observer: StateObserver) {
    this.observers.push(observer);
  }

  public removeObserver(observer: StateObserver) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  private notifyObservers(
    status: string,
    state: { [key: string]: string },
    timestamp: number,
  ) {
    for (const observer of this.observers) {
      observer.update(status, state, timestamp);
    }
  }

  addState(status: string, state: { [key: string]: string }) {
    const timestamp = Date.now();
    this.history.push({
      status: this.status,
      state: this.state,
      timestamp,
    });

    this.status = status;
    this.state = { ...this.shared, ...state };

    this.notifyObservers(this.status, this.state, timestamp);
  }

  public process(data: LogEntry) {
    if (data.class === 'Provider') {
      if (data.method == 'runOperation') {
        if (data.type == 'call') {
          this.addState('running-operation', {
            operation: data.arguments[0],
            flow: data.arguments[1].id,
            opIndex: data.arguments[1].index,
          });
        }

        if (data.type == 'return') {
          if (data.result == true) {
            this.addState('running-operation-success', {
              operation: data.arguments[0],
              flow: data.arguments[1].id,
              opIndex: data.arguments[1].index,
            });
          } else {
            this.addState('running-operation-failed', {
              operation: data.arguments[0],
              flow: data.arguments[1].id,
              opIndex: data.arguments[1].index,
            });
          }
        }
      }

      if (data.method == 'stopOperation') {
        if (data.type == 'call') {
          this.addState('stop-operation', {
            operation: data.arguments[0],
            flow: data.arguments[1].id,
            opIndex: data.arguments[1].index,
          });
        }

        if (data.type == 'return') {
          if (data.result == true) {
            this.addState('stop-operation-success', {
              operation: data.arguments[0],
              flow: data.arguments[1].id,
              opIndex: data.arguments[1].index,
            });
          } else {
            this.addState('stop-operation-failed', {
              operation: data.arguments[0],
              flow: data.arguments[1].id,
              opIndex: data.arguments[1].index,
            });
          }
        }
      }
    }

    if (
      data.class === 'PodmanContainerOrchestration' ||
      data.class === 'DockerContainerOrchestration' ||
      data.class == 'ContainerOrchestrationInterface'
    ) {
      if (data.method == 'pullImage') {
        if (data.type == 'call') {
          this.addState('pulling-image', { image: data.arguments[0] });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('pulling-image-success', {
              image: data.arguments[0],
            });
          } else {
            this.addState('pulling-image-failed', {
              image: data.arguments[0],
              error: data.result.error,
            });
          }
        }
      }

      if (data.method == 'createNetwork') {
        if (data.type == 'call') {
          this.addState('creating-network', { network: data.arguments[0] });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('creating-network-success', {
              network: data.arguments[0],
            });
          } else {
            this.addState('creating-network-failed', {
              network: data.arguments[0],
              error: data.result.error,
            });
          }
        }
      }

      if (data.method == 'deleteNetwork') {
        if (data.type == 'call') {
          this.addState('deleting-network', { network: data.arguments[0] });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('deleting-network-success', {
              network: data.arguments[0],
            });
          } else {
            this.addState('deleting-network-failed', {
              network: data.arguments[0],
              error: data.result.error,
            });
          }
        }
      }

      if (data.method == 'runContainer') {
        if (data.type == 'call') {
          this.addState('running-container', {
            image: data.arguments[0].Image,
          });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('running-container-success', {
              image: data.arguments[0].Image,
              id: data.result.result.id,
            });
          } else {
            this.addState('running-container-failed', {
              image: data.arguments[0].Image,
              error: data.result.error,
            });
          }
        }
      }

      if (data.method == 'runFlowContainer') {
        if (data.type == 'call') {
          this.addState('running-container', {
            image: data.arguments[0],
            name: data.arguments[1].name,
          });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('running-container-success', {
              image: data.arguments[0],
              name: data.arguments[1].name,
              id: data.result.result.id,
            });
          } else {
            this.addState('running-container-failed', {
              image: data.arguments[0],
              error: data.result.error,
            });
          }
        }
      }

      if (data.method == 'stopAndDeleteContainer') {
        if (data.type == 'call') {
          this.addState('stopping-container', { id: data.arguments[0] });
        }

        if (data.type == 'return') {
          if (data.result.status == true) {
            this.addState('stopping-container-success', {
              id: data.arguments[0],
            });
          } else {
            this.addState('stopping-container-failed', {
              id: data.arguments[0],
              error: data.result.error,
            });
          }
        }
      }
    }

    if (data.class === 'HealthHandler') {
      if (data.method === 'run') {
        if (data.type === 'return') {
          this.addState('health-check-running', {});
        }

        if (data.type === 'error') {
          this.addState('health-check-failed', {});
        }
      }
    }

    if (data.class === 'BasicNode') {
      if (data.method == 'start') {
        if (data.type == 'call') {
          this.addState('node-starting', { node: this.shared.node });
        }

        if (data.type == 'error') {
          this.addState('node-starting-failed', {
            node: this.shared.node,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('node-started', { node: this.shared.node });
        }
      }

      if (data.method === 'restartDelay') {
        if (data.type == 'call') {
          this.addState('node-restarting', { node: this.shared.node });
        }

        if (data.type == 'return') {
          this.addState('node-restarted', { node: this.shared.node });
        }
      }

      if (data.method == 'stop') {
        if (data.type == 'call') {
          this.addState('node-stopping', { node: this.shared.node });
        }

        if (data.type == 'error') {
          this.addState('node-stopping-failed', {
            node: this.shared.node,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('node-stopped', { node: this.shared.node });

          this.shared = {
            node: this.shared.node,
          };
        }
      }

      if (data.method == 'benchmark') {
        if (data.type == 'call') {
          this.addState('benchmark-running', { node: this.shared.node });
        }

        if (data.type == 'error') {
          this.addState('benchmark-error', {
            node: this.shared.node,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          if (data.result == true) {
            this.addState('benchmark-passed', { node: this.shared.node });
          } else {
            this.addState('benchmark-failed', { node: this.shared.node });
          }
        }
      }

      if (data.method == 'queue') {
        const market = data.arguments[0];
        this.shared.market = market;

        if (data.type == 'call') {
          this.addState('queueing-in-market', {
            node: this.shared.node,
            market,
          });
        }

        if (data.type == 'error') {
          this.addState('queueing-in-market-failed', {
            node: this.shared.node,
            market,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('queueing-in-market-success', {
            node: this.shared.node,
            market,
          });
        }
      }
    }

    if (data.class === 'MarketHandler') {
      if (data.method == 'processMarketQueuePosition') {
        if (data.type == 'return') {
          this.addState('queueing-in-market-position', {
            node: this.shared.node,
            market: this.shared.market,
            position: data.result.position,
            count: data.result.count,
          });
        }
      }
    }

    if (data.class === 'ExpiryHandler') {
      if (data.method === 'init') {
        if (data.type == 'return') {
          this.addState('job-expiry-init', {
            expiry: data.result,
          });
        }
      }

      if (data.method === 'waitUntilExpired') {
        if (data.type == 'call') {
          this.addState('awaiting-job-expire', {});
        }

        if (data.type == 'call') {
          this.addState('job-finish', {});
        }
      }
    }

    if (data.class === 'FlowHandler') {
      if (data.method === 'operationExposed') {
        if (data.type === 'return') {
          this.shared.serviceUrlReady = data.result;
          this.addState('service-url-ready', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
            url: data.result,
            args: data.arguments[0],
          });
        }
      }
    }

    if (data.class === 'JobExternalUtil') {
      if (data.method == 'resolveJobDefinition') {
        if (data.type == 'call') {
          this.addState('awaiting-job-definition', {});
        }

        if (data.type == 'error') {
          this.addState('awaiting-job-definition-failed', {
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('awaiting-job-definition-success', {});
        }
      }

      if (data.method == 'resolveResult') {
        if (data.type == 'call') {
          this.addState('awaiting-result-send', {});
        }

        if (data.type == 'error') {
          this.addState('awaiting-result-send-failed', {
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('awaiting-result-send-success', {});
        }
      }
    }

    if (data.class === 'JobHandler') {
      if (data.method == 'claim') {
        const job = data.arguments[0];
        this.shared.job = job;

        if (data.type == 'call') {
          this.addState('claiming-job', {
            node: this.shared.node,
            market: this.shared.market,
            job,
          });
        }

        if (data.type == 'error') {
          this.addState('claiming-job-failed', {
            node: this.shared.node,
            market: this.shared.market,
            job,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('claiming-job-success', {
            node: this.shared.node,
            market: this.shared.market,
            job,
          });
        }
      }

      if (data.method == 'resume') {
        if (data.type == 'return') {
          this.addState('job-resuming', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }
      }

      if (data.method == 'start') {
        if (data.type == 'call') {
          this.addState('job-starting', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }

        if (data.type == 'error') {
          this.addState('job-starting-failed', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          if (data.result == true) {
            this.addState('job-starting-success', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
            });
          } else {
            this.addState('job-starting-failed', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
            });
          }
        }
      }

      if (data.method == 'exposed') {
        if (data.type == 'return') {
          if (data.result == true) {
            this.shared.expose = 'true';
            this.addState('job-exposing', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
              exposed: this.shared.expose,
            });
          } else {
            this.shared.expose = 'false';
          }
        }
      }

      if (data.method == 'run') {
        if (data.type == 'call') {
          this.addState('job-running', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }

        if (data.type == 'error') {
          this.addState('job-running-failed', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('job-running-success', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }
      }

      if (data.method == 'idle') {
        if (data.type == 'call') {
          this.addState('job-exposing', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
            exposed: this.shared.expose,
            waittime: data.arguments[0],
          });
        }
      }

      if (data.method == 'wait') {
        if (data.type == 'call') {
          this.addState('job-waiting', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }

        if (data.type == 'return') {
          this.addState('job-waiting-done', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }
      }

      if (data.method == 'expired') {
        if (data.type == 'return') {
          if (data.result == 'true') {
            this.addState('job-expired', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
            });
          }
        }

        delete this.shared.serviceUrlReady;
        delete this.shared.job;

        this.addState('service-url-closed', {
          node: this.shared.node,
          market: this.shared.market,
          job: this.shared.job,
        });
      }

      if (data.method == 'validate') {
        if (data.type == 'call') {
          this.addState('job-validating', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }

        if (data.type == 'return') {
          if (data.result == true) {
            this.addState('job-validating-success', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
            });
          } else {
            this.addState('job-validating-failed', {
              node: this.shared.node,
              market: this.shared.market,
              job: this.shared.job,
            });
          }
        }
      }

      if (data.method == 'finish') {
        if (data.type == 'call') {
          this.addState('job-finishing', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });

          delete this.shared.job;
        }

        if (data.type == 'error') {
          this.addState('job-finishing-failed', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
            error: `${data.error}`,
          });
        }

        if (data.type == 'return') {
          this.addState('job-finishing-success', {
            node: this.shared.node,
            market: this.shared.market,
            job: this.shared.job,
          });
        }

        delete this.shared.serviceUrlReady;

        this.addState('service-url-closed', {
          node: this.shared.node,
          market: this.shared.market,
          job: this.shared.job,
        });
      }
    }

    if (data.class === 'ApiHandler') {
      if (data.method == 'start') {
        if (data.type == 'call') {
          this.addState('api-starting', { node: this.shared.node });
        }

        if (data.type == 'error') {
          this.addState('api-starting-failed', { error: `${data.error}` });
        }

        if (data.type == 'return') {
          this.addState('api-started', { node: this.shared.node });
        }
      }

      if (data.method == 'stop') {
        if (data.type == 'call') {
          this.addState('api-stopping', { node: this.shared.node });
        }

        if (data.type == 'error') {
          this.addState('api-stopping-failed', { error: `${data.error}` });
        }

        if (data.type == 'return') {
          this.addState('api-stopped', { node: this.shared.node });
        }
      }
    }

    if (data.class === 'ProgressBarReporter') {
      if (data.method === 'start' && data.type == 'call') {
        this.addState('process-bar-start', {
          desc: data.arguments[0],
          optProgressBar: data.arguments[1],
          total: data.arguments[2],
          startValue: data.arguments[3],
          payload: data.arguments[4],
          progressBarPreset: data.arguments[5],
        });
      }

      if (data.method === 'update' && data.type == 'call') {
        this.addState('process-bar-update', {
          current: data.arguments[0],
          payload: data.arguments[1],
        });
      }

      if (data.method === 'stop' && data.type == 'call') {
        this.addState('process-bar-stop', {
          desc: data.arguments[0],
        });
      }
    }

    if (data.class === 'MultiProgressBarReporter') {
      if (data.method === 'start' && data.type == 'call') {
        this.addState('multi-process-bar-start', {
          desc: data.arguments[0],
          optProgressBar: data.arguments[1],
          total: data.arguments[2],
          startValue: data.arguments[3],
          payload: data.arguments[4],
          progressBarPreset: data.arguments[5],
        });
      }

      if (data.method === 'update' && data.type == 'call') {
        this.addState('multi-process-bar-update', {
          event: data.arguments[0],
        });
      }

      if (data.method === 'stop' && data.type == 'call') {
        this.addState('multi-process-bar-stop', {
          desc: data.arguments[0],
        });
      }
    }
  }
}
