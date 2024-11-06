import ora, { Ora } from 'ora';
import { log, LogObserver, NodeLogEntry } from '../NodeLog.js';
import { SingleBar } from 'cli-progress';

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

  spinner!: Ora;

  constructor() {}

  addObserver() {
    log().addObserver(this);
  }

  public update(log: NodeLogEntry, isNode: boolean = true) {
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
        log.payload?.optProgressBar,
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
          if (log.log != '') {
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
          } else if (log.type == 'error') {
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
  }
}
