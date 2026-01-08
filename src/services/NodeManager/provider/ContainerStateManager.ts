import { parseBuffer } from './utils/parseBuffer.js';

import type EventEmitter from 'events';
import type Dockerode from 'dockerode';
import type { RestartPolicy } from '@nosana/sdk';
type ContainerState = 'starting' | 'running' | 'exited' | 'restarting';

export class ContainerStateManager {
  private state: ContainerState = 'starting';
  private exitedCheckCount: number = 0;
  private lastLogTimestamp: number = 0; // Unix timestamp in seconds from actual container logs
  private readonly EXITED_CHECKS_REQUIRED = 3; // Require 3 consecutive checks before confirming exit
  private currentLogStream: NodeJS.ReadableStream | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private container: Dockerode.Container,
    private controller: AbortController,
    private emitter: EventEmitter,
    private restartPolicy: RestartPolicy | undefined,
  ) {}

  getState(): ContainerState {
    return this.state;
  }

  async startMonitoring() {
    await this.attachLogStream();

    if (!this.restartPolicy) {
      this.container
        .wait({ abortSignal: this.controller.signal })
        .finally(() => {
          this.state = 'exited';
        });
      return;
    }

    this.pollingInterval = setInterval(async () => {
      if (this.controller.signal.aborted) {
        this.stopMonitoring();
        return;
      }

      try {
        const inspectInfo = await this.container.inspect();
        let inspectedState = inspectInfo.State.Status.toLowerCase();

        if (['running', 'restarting'].includes(inspectedState)) {
          this.exitedCheckCount = 0;
          this.state = inspectedState as ContainerState;
          return;
        }

        this.exitedCheckCount++;
        if (this.exitedCheckCount >= this.EXITED_CHECKS_REQUIRED) {
          this.state = 'exited';
        }
      } catch (error) {
        this.exitedCheckCount++;
        if (this.exitedCheckCount >= this.EXITED_CHECKS_REQUIRED) {
          this.state = 'exited';
          this.stopMonitoring();
        }
      }
    }, 1000);
  }

  private async attachLogStream() {
    try {
      this.currentLogStream = await this.container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true,
        since: this.lastLogTimestamp + 1,
        abortSignal: this.controller.signal,
      });

      this.currentLogStream.on('data', (data) => {
        const { log, type, timestamp } = parseBuffer(data);
        if (!log) return;

        this.lastLogTimestamp = Math.floor(
          new Date(timestamp).getTime() / 1000,
        );
        this.emitter.emit('log', log, type, 'container');
      });

      this.currentLogStream.on('close', () => {
        this.currentLogStream = null;

        if (this.state === 'running' && !this.controller.signal.aborted) {
          setTimeout(() => this.attachLogStream(), 100);
        }
      });

      // Clean up on abort
      const abortHandler = () => {
        this.currentLogStream?.removeAllListeners();
        if (
          this.currentLogStream &&
          'destroy' in this.currentLogStream &&
          typeof this.currentLogStream.destroy === 'function'
        ) {
          this.currentLogStream.destroy();
        }
        this.currentLogStream = null;
      };
      this.controller.signal.addEventListener('abort', abortHandler, {
        once: true,
      });
    } catch (error) {
      if (this.state === 'running' && !this.controller.signal.aborted) {
        setTimeout(() => this.attachLogStream(), 1000);
      }
    }
  }

  async waitForExit(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.state === 'exited' || this.controller.signal.aborted) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  stopMonitoring() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.currentLogStream) {
      this.currentLogStream.removeAllListeners();
      if (
        'destroy' in this.currentLogStream &&
        typeof this.currentLogStream.destroy === 'function'
      ) {
        (this.currentLogStream as any).destroy();
      }
      this.currentLogStream = null;
    }
  }
}
