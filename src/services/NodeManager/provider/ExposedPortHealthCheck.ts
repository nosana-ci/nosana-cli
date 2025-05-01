import {
  ExposedPort,
  HttpHealthCheck,
  WebSocketHealthCheck,
} from '@nosana/sdk';
import Dockerode from 'dockerode';
import EventEmitter from 'events';

export class ExposedPortHealthCheck {
  private exposedPortMap: Map<string, ExposedPort> = new Map();
  private frpcContainer: Dockerode.Container;
  private containerName: string;
  private startupIntervalMs: number;
  private continuousIntervalMs: number;
  /**
   * Tracks job previous state to show change in state of job mainly when going from failed to success.
   */
  private healthStatus: Map<string, boolean> = new Map();
  private jobEmitter: EventEmitter;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  private flowId: string;

  constructor(
    flowId: string,
    frpcContainer: Dockerode.Container,
    jobEmitter: EventEmitter,
    containerName: string,
    startupIntervalMs = 5000,
    continuousIntervalMs = 30000,
  ) {
    this.flowId = flowId;
    this.frpcContainer = frpcContainer;
    this.jobEmitter = jobEmitter;
    this.containerName = containerName;
    this.startupIntervalMs = startupIntervalMs;
    this.continuousIntervalMs = continuousIntervalMs;
  }

  addExposedPortsMap(exposedPortMap: Map<string, ExposedPort>) {
    this.exposedPortMap = exposedPortMap;
  }

  startServiceExposedUrlHealthCheck() {
    for (const [id, exposedPort] of this.exposedPortMap) {
      this.startStartupHealthCheck(id, exposedPort);
    }
  }

  private startStartupHealthCheck(id: string, exposedPort: ExposedPort) {
    let startupCheckInterval: NodeJS.Timeout | null = null;

    startupCheckInterval = setInterval(async () => {
      const success = await this.checkPortHealth(exposedPort);

      if (success == null) {
        clearInterval(startupCheckInterval!);
        this.jobEmitter.emit('run-exposed', {
          id,
          flowId: this.flowId,
          port: exposedPort.port,
          service: exposedPort.type,
        });
        return;
      }

      if (success) {
        clearInterval(startupCheckInterval!);
        this.jobEmitter.emit('startup-success', {
          id,
          flowId: this.flowId,
          port: exposedPort.port,
          service: exposedPort.type,
        });

        // **Start continuous health check only after startup success**
        this.startContinuousHealthCheck(id, exposedPort);
      }
    }, this.startupIntervalMs);

    // Store the interval so we can stop it later
    this.intervals.set(id, startupCheckInterval);
  }

  private startContinuousHealthCheck(id: string, exposedPort: ExposedPort) {
    let continuousCheckInterval = setInterval(async () => {
      const healthStatus = await this.checkPortHealth(exposedPort);

      if (healthStatus === null) {
        clearInterval(continuousCheckInterval!);
        return; // Skip logging or emitting events if no check was done.
      }

      const previousState = this.healthStatus.get(id) || false;

      if (healthStatus !== previousState) {
        this.healthStatus.set(id, healthStatus);
        if (!healthStatus) {
          this.jobEmitter.emit('continuous-failure', {
            id,
            flowId: this.flowId,
            port: exposedPort.port,
            service: exposedPort.type,
          });
        }
      }
    }, this.continuousIntervalMs);

    this.intervals.set(id, continuousCheckInterval);
  }

  public stopHealthCheckForId(id: string) {
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id)!);
      this.intervals.delete(id);
      this.healthStatus.delete(id);
      this.exposedPortMap.delete(id);
    }
  }

  public stopAllHealthChecks() {
    this.intervals.forEach((interval, id) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    this.healthStatus.clear();
    this.exposedPortMap.clear();
  }

  private async checkPortHealth(
    exposedPort: ExposedPort,
  ): Promise<boolean | null> {
    if (!exposedPort.health_checks || exposedPort.health_checks.length === 0) {
      return null; // Return null to indicate no check was done.
    }

    for (const healthCheck of exposedPort.health_checks) {
      if (healthCheck.type === 'http') {
        const success = await this.runHttpHealthCheck(
          exposedPort.port,
          healthCheck,
        );
        if (!success) return false;
      } else if (healthCheck.type === 'websocket') {
        const success = await this.runWebSocketHealthCheck(
          exposedPort.port,
          healthCheck,
        );
        if (!success) return false;
      }
    }

    return true;
  }

  private async runHttpHealthCheck(
    port: number,
    healthCheck: HttpHealthCheck,
  ): Promise<boolean> {
    const url = `http://${this.containerName}:${port}${healthCheck.path}`;
    const cmd: string[] = [
      'curl',
      '-s',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '-X',
      healthCheck.method,
      url,
    ];

    if (healthCheck.headers) {
      for (const [key, value] of Object.entries(healthCheck.headers)) {
        cmd.push('-H', `${key}: ${value}`);
      }
    }

    if (healthCheck.body && ['POST', 'PUT'].includes(healthCheck.method)) {
      const bodyString =
        typeof healthCheck.body === 'string'
          ? healthCheck.body
          : JSON.stringify(healthCheck.body);
      cmd.push('--data', bodyString);
    }

    try {
      const output = await this.execCommand(cmd);
      return (
        Buffer.from(output, 'utf-8')
          .toString()
          .replace(/[^\x20-\x7E]/g, '')
          .trim() == healthCheck.expected_status.toString()
      );
    } catch (error) {
      return false;
    }
  }

  private async runWebSocketHealthCheck(
    port: number,
    healthCheck: WebSocketHealthCheck,
  ): Promise<boolean> {
    const cmd = ['curl', '--include', '--no-buffer', `ws://localhost:${port}`];

    try {
      const output = await this.execCommand(cmd);
      return output.includes(healthCheck.expected_response);
    } catch (error) {
      return false;
    }
  }

  private async execCommand(cmd: string[]): Promise<string> {
    try {
      const exec = await this.frpcContainer.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: true });

      return new Promise((resolve, reject) => {
        let output = '';

        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('end', () => {
          resolve(output);
        });

        stream.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      throw new Error(`Exec failed: ${error}`);
    }
  }
}
