import ora, { Ora } from 'ora';
import { log, LogObserver, NodeLogEntry } from '../NodeLog.js';
import { MultiBar, Presets, SingleBar } from 'cli-progress';
import chalk from 'chalk';
import { convertFromBytes } from '../../../../../providers/utils/convertFromBytes.js';
import { LogMonitoringRegistry } from '../../LogMonitoringRegistry.js';

export const consoleLogging = (() => {
  let instance: ConsoleLogger | null = null;

  return () => {
    if (!instance) {
      instance = new ConsoleLogger();
      instance.addObserver();
    }
    return instance;
  };
})();

export class ConsoleLogger implements LogObserver {
  private pending: boolean = false;
  private expecting: string | undefined;
  private progressBar: SingleBar | undefined;
  private layerIds: Map<string, SingleBar> | undefined;
  private multiProgressBar: MultiBar | undefined;
  private kill: boolean = false;
  private benchmarking: boolean = false;
  private taskManagerActive: boolean = false;
  private running: boolean = false;

  spinner!: Ora;

  constructor(public isNode: boolean = true) {}

  addObserver() {
    log().addObserver(this);
  }

  public isNodeObserver() {
    return this.isNode;
  }

  public update(log: NodeLogEntry, isNode: boolean = true) {
    if (!this.kill && log.type == 'kill-process') {
      if (this.pending) {
        this.spinner.stop();
      }
      if (this.progressBar) {
        this.progressBar.stop();
      }
      if (this.multiProgressBar) {
        this.multiProgressBar.stop();
      }

      this.kill = true;
      this.pending = true;
      this.expecting = log.pending?.expecting;

      if (isNode && this.taskManagerActive) {
        this.spinner.succeed(
          chalk.yellow(`${chalk.bgYellow.bold(' TASKMANAGER ')} Exited`),
        );
      }

      this.spinner = ora(log.log).start();
    }

    if (this.kill) {
      if (log.type == 'kill-success') {
        this.spinner.succeed(log.log);
        this.kill = false;
        this.pending = false;
      } else if (log.type == 'kill-error') {
        this.spinner.fail(log.log);
        this.kill = false;
        this.pending = false;
      } else {
        return;
      }
      return;
    }

    if (isNode) {
      // --- TaskManager quiet window ---
      if (log.method === 'TaskManager.start' && log.type === 'process') {
        // Stop anything currently animating
        if (this.pending) this.spinner.stop();
        if (this.progressBar) this.progressBar.stop();
        if (this.multiProgressBar) this.multiProgressBar.stop();

        this.taskManagerActive = true;
        this.pending = true;

        this.spinner = ora(
          chalk.yellow(
            `${chalk.bgYellow.bold(' TASKMANAGER ')} Running ${log.job}...`,
          ),
        ).start();

        // Block everything else until we see TaskManager.stop
        return;
      }

      // While TaskManager is active, swallow all logs except the stop signal
      if (this.taskManagerActive) {
        if (log.method === 'TaskManager.start') {
          this.spinner.succeed(
            chalk.yellow(
              `${chalk.bgYellow.bold(' TASKMANAGER ')} Ending ${log.job}...`,
            ),
          );
          this.taskManagerActive = false;
          this.pending = false;
          return;
        }

        // Still inside TaskManager window: block other logs
        return;
      }
    }

    if (
      !this.benchmarking &&
      log.method == 'BasicNode.specs' &&
      log.type == 'process'
    ) {
      this.benchmarking = true;
      this.pending = true;

      this.spinner = ora(
        chalk.green(`${chalk.bgGreen.bold(' Checking Specs ')}`),
      ).start();
      return;
    }

    if (this.benchmarking) {
      // this.spinner.text =
      //   chalk.cyan(`${this.spinner.text}\n`) + chalk.cyan(` \t➡️  ${log.log}`);
    }

    if (this.benchmarking && log.method == 'BasicNode.specs') {
      this.benchmarking = false;
      this.pending = false;
      if (log.type == 'success') {
        this.spinner.succeed(log.log);
      } else if (log.type == 'error') {
        this.spinner.fail(log.log);
      }
      return;
    } else if (this.benchmarking) {
      return;
    }

    // if (log.job && isNode) {
    //   if (this.pending) {
    //     this.spinner.stop();
    //   }

    //   this.spinner = ora(
    //     chalk.green(
    //       `${chalk.bgGreen.bold(' RUNNING ')} job ${chalk.bold(log.job)}`,
    //     ),
    //   ).start();
    //   return;
    // }

    if (log.type == 'log') {
      if (!isNode) {
        process.stdout.write(log.log);
      }
      return;
    }

    if (log.type == 'process-bar-start') {
      if (this.pending) {
        this.spinner.stop();
      }
      if (this.progressBar) {
        this.progressBar.stop();
      }

      this.progressBar = new SingleBar(
        {
          ...log.payload?.optProgressBar,
          clearOnComplete: true,
        },
        log.payload.progressBarPreset,
      );
      this.progressBar.start(
        log.payload?.total,
        log.payload?.startValue,
        log.payload?.payload,
      );

      return;
    }

    if (log.type == 'process-bar-update') {
      this.progressBar?.update(log.payload?.current, log.payload?.payload);
      return;
    }

    if (log.type == 'process-bar-stop') {
      this.progressBar?.stop();
      this.progressBar = undefined;
      return;
    }

    if (log.type == 'multi-process-bar-start') {
      if (this.pending) {
        this.spinner.stop();
      }
      if (this.multiProgressBar) {
        this.multiProgressBar.stop();
      }

      if (!this.layerIds) {
        this.layerIds = new Map<string, SingleBar>();
      }

      this.multiProgressBar = new MultiBar(
        {
          fps: 200,
          clearOnComplete: true,
          hideCursor: true,
          ...log.payload?.optProgressBar,
        },
        Presets.shades_grey,
      );

      return;
    }

    if (log.type == 'multi-process-bar-update') {
      const { id, status, progressDetail } = log.payload?.event;

      if (status === 'Pulling fs layer') return;

      let progressBar = this.layerIds?.get(id);

      if (status === 'Downloading') {
        const { current, total } = progressDetail;

        const { format, value: totalValue } = convertFromBytes(total);
        const { value } = convertFromBytes(current, format);
        if (!progressBar) {
          progressBar = this.multiProgressBar?.create(totalValue, value, {
            status,
            layerId: id,
            format,
          });
          this.layerIds?.set(id, progressBar as SingleBar);
        }
        progressBar?.update(value, { status });
        return;
      }

      if (status === 'Download complete' || status === 'Already exists') {
        let progressBar = this.layerIds?.get(id);
        if (!progressBar) {
          progressBar = this.multiProgressBar?.create(100, 100, {
            status,
            layerId: id,
            format: 'kb',
          });
        }
        progressBar?.update(progressBar?.getTotal(), { status });
      }

      if (progressBar) {
        progressBar.update(progressBar.getTotal(), { status });
      }
      return;
    }

    if (log.type == 'multi-process-bar-stop') {
      this.multiProgressBar?.stop();
      this.multiProgressBar = undefined;
      this.layerIds = undefined;
      return;
    }

    if (this.pending) {
      if (log.type == 'update') {
        this.spinner.text = log.log;
        return;
      }

      if (log.type == 'add') {
        console.log(log.log);
        return;
      }

      if (
        log.type == 'error' ||
        log.method == this.expecting ||
        log.type == 'stop'
      ) {
        if (log.type == 'error' && log.method !== this.expecting) {
          this.spinner.stop();
          this.pending = false;
        }

        if (log.type == 'stop') {
          this.spinner.stop();
          if (log.log == '') {
            return;
          } else {
            console.log(log.log);
          }
          this.pending = false;
        } else {
          if (log.type == 'success') {
            if (this.spinner.text.includes('\n')) {
              // Split the text by the first newline and keep the part after it
              const [, rest] = this.spinner.text.split(/\n(.+)/); // Match the first occurrence and keep the rest
              // Update the spinner text by replacing the part before the first newline
              this.spinner.succeed(`${log.log}\n${rest}`);
            } else {
              this.spinner.succeed(log.log);
            }
          } else if (log.type == 'error' || log.type == 'kill-error') {
            if (this.spinner.text.includes('\n')) {
              const [, rest] = this.spinner.text.split(/\n(.+)/);
              this.spinner.fail(`${log.log}\n${rest}`);
            } else {
              this.spinner.fail(log.log);
            }
          }
          this.pending = false;
        }
      }
    } else {
      if (log.pending?.isPending) {
        this.pending = true;
        this.expecting = log.pending?.expecting;
        this.spinner = ora(log.log).start();
      } else {
        console.log(log.log);
      }
    }

    if (log.method == 'BasicNode.restartDelay' && log.type == 'success') {
      this.expecting = undefined;
      this.kill = false;
      this.benchmarking = false;
      this.running = false;
      this.taskManagerActive = false;
      this.spinner.stop();
    }
  }
}
