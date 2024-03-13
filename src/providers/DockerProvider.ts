import chalk from 'chalk';
import {
  Operation,
  Provider,
  OpState,
  Flow,
  OperationArgsMap,
} from './Provider';
import Docker, { Container, MountType } from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import { BasicProvider } from './BasicProvider';
import { sleep } from '../generic/utils.js';
import util from 'util';

export class DockerProvider extends BasicProvider implements Provider {
  private docker: Docker;
  protected supportedOps: { [key: string]: string } = {
    'container/run': this.opContainerRun.name,
    'container/create-volume': this.opCreateVolume.name,
  };

  constructor(podman: string) {
    super();
    const podmanUri = new URL(
      podman.startsWith('http') || podman.startsWith('ssh')
        ? podman
        : `http://${podman}`,
    );
    const protocol = podmanUri.protocol.replace(':', '');
    if (
      !['https', 'http', 'ssh'].includes(protocol) &&
      typeof protocol !== 'undefined'
    ) {
      throw new Error(`Protocol ${protocol} not supported`);
    }

    this.docker = new Docker({
      host: podmanUri.hostname,
      port: podmanUri.port,
      protocol: protocol as 'https' | 'http' | 'ssh' | undefined,
    });
  }

  /**
   * Check if DockerProvider is healthy by checking if podman is running
   * @returns boolean
   */
  public async healthy(throwError: Boolean = true): Promise<Boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      if (throwError) {
        throw error;
      }
      console.error(error);
      return false;
    }
  }

  /**
   * Run operation and return results
   * @param op Operation specs
   * @returns OpState
   */
  private async opContainerRun(
    op: Operation<'container/run'>,
    flowId: string,
    updateOpState: Function,
  ): Promise<OpState> {
    const flow = this.getFlow(flowId) as Flow;
    const opStateIndex = flow.state.opStates.findIndex(
      (opState) => op.id === opState.operationId,
    );
    const opState = flow.state.opStates[opStateIndex];

    if (opState.providerId) {
      await new Promise<void>(async (resolve, reject) => {
        const c = await this.getContainerByName(opState.providerId as string);

        // when node is shutted down before the container started, it won't find the container
        // clear providerId so that it will be ran again
        if (!c) {
          updateOpState({ providerId: null });
          resolve();
        } else {
          const container = this.docker.getContainer(c.Id);
          const containerInfo = await container.inspect();

          // Create streams and wait for it to finish
          if (containerInfo.State.Running) {
            // wait for log streams to finish, handle new logs with callback
            try {
              const logs: OpState['logs'] = [];
              await this.handleLogStreams(
                container,
                (data: {
                  log: string;
                  type: 'stdin' | 'stdout' | 'stderr';
                }) => {
                  this.eventEmitter.emit('newLog', {
                    type: data.type,
                    log: data.log,
                  });
                  logs.push({
                    type: data.type,
                    log: data.log,
                  });
                  updateOpState({ logs });
                },
              );
            } catch (e) {
              console.log(
                chalk.red(`Error handling log streams for ${c.Id}`, e),
              );
            }

            await this.finishOpContainerRun(
              container,
              updateOpState,
              containerInfo,
            );
            resolve();
          } else if (containerInfo.State.Status === 'exited') {
            await this.finishOpContainerRun(
              container,
              updateOpState,
              containerInfo,
            );
            resolve();
          }
        }
      });
    }

    if (!opState.providerId) {
      updateOpState({
        startTime: Date.now(),
        status: 'running',
      });
      await this.executeCmd(op.args, flowId, opStateIndex, updateOpState);
    }
    return flow.state.opStates[opStateIndex];
  }

  /**
   * Create volume
   * @param op Operation specs
   */
  private async opCreateVolume(
    op: Operation<'container/run'>,
    flowId: string,
    updateOpState: Function,
  ): Promise<string> {
    updateOpState({
      startTime: Date.now(),
      status: 'running',
    });

    return await new Promise(async (resolve, reject): Promise<any> => {
      this.docker.createVolume(
        {
          Name: op.id,
        },
        (err, volume) => {
          if (err) {
            console.log(err);
            updateOpState({
              endTime: Date.now(),
              status: 'failed',
              logs: [
                {
                  type: 'stderr',
                  log: err.message,
                },
              ],
            });
            reject(err);
          }
          updateOpState({
            endTime: Date.now(),
            status: 'success',
          });
          resolve(op.id);
        },
      );
    });
  }

  /**
   * Pull docker image
   * @param image
   * @returns
   */
  private async pullImage(image: string) {
    return await new Promise((resolve, reject): any =>
      this.docker.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
        } else {
          this.docker.modem.followProgress(stream, onFinished);
        }
        function onFinished(err: any, output: any) {
          if (!err) {
            resolve(true);
            return;
          }
          reject(err);
        }
      }),
    );
  }

  /**
   * Prune volumes that are not being used by containers
   * @returns
   */
  private async pruneVolumes() {
    return await new Promise<void>((resolve, reject): any =>
      this.docker.pruneVolumes({}, (result) => {
        resolve();
      }),
    );
  }

  /**
   * Perform docker.run for given cmd, return logs
   * @param opArgs
   * @param flowId
   * @param opStateIndex
   * @returns
   */
  private async executeCmd(
    opArgs: OperationArgsMap['container/run'],
    flowId: string,
    opStateIndex: number,
    updateOpState: Function,
  ): Promise<OpState> {
    return await new Promise<OpState>(async (resolve, reject) => {
      let cmd = '';
      for (let i = 0; i < opArgs.cmds.length; i++) {
        if (i === 0) {
          cmd += opArgs.cmds[i];
        } else {
          cmd += "'" + opArgs.cmds[i] + "'";
        }
      }
      const flow = this.getFlow(flowId) as Flow;
      const parsedcmd = parse(cmd);

      try {
        await this.pullImage(opArgs.image);
      } catch (error: any) {
        reject(chalk.red(`Cannot pull image ${opArgs.image}: `) + error);
      }

      // when flow is being cleared, resolve promise
      this.eventEmitter.on('startClearFlow', (id) => {
        if (id === flowId) {
          this.eventEmitter.removeAllListeners('startClearFlow');
          resolve(flow.state.opStates[opStateIndex]);
        }
      });

      const name =
        opArgs.image +
        '-' +
        [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
      updateOpState({ providerId: name });

      const logs: OpState['logs'] = [];

      this.handleLogStreams(
        name,
        (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
          this.eventEmitter.emit('newLog', {
            type: data.type,
            log: data.log,
          });
          logs.push({
            type: data.type,
            log: data.log,
          });
          updateOpState({ logs });
        },
        3,
      ).catch((e) => {
        console.log(chalk.red(`Error handling log streams for ${name}`, e));
      });

      // create volume mount array
      const volumes = [];
      if (opArgs.volumes && opArgs.volumes.length > 0) {
        for (let i = 0; i < opArgs.volumes.length; i++) {
          const volume = opArgs.volumes[i];
          volumes.push({
            Target: volume.dest,
            Source: volume.name,
            Type: 'volume' as MountType,
            ReadOnly: false,
          });
        }
      }

      // pass stream, but we are not using it, as we are using handleLogStreams
      const emptyStream = new stream.PassThrough();
      return await this.docker
        .run(opArgs.image, parsedcmd as string[], emptyStream, {
          name,
          Tty: false,
          HostConfig: {
            Mounts: volumes,
            // --gpus all
            DeviceRequests: [
              {
                Count: -1,
                Driver: 'nvidia',
                Capabilities: [['gpu']],
              },
            ],
          },
        })
        .then(async ([res, container]) => {
          await this.finishOpContainerRun(container, updateOpState);
          emptyStream.end();
          this.eventEmitter.removeAllListeners('startClearFlow');
          resolve(flow.state.opStates[opStateIndex]);
        })
        .catch((error) => {
          this.eventEmitter.removeAllListeners('startClearFlow');
          reject(error);
        });
    });
  }

  /**
   * Finish container run, extract results and update opState
   * @param container
   * @param opState
   * @param containerInfo optional
   */
  private async finishOpContainerRun(
    container: Docker.Container,
    updateOpState: Function,
    containerInfo?: Docker.ContainerInspectInfo,
  ): Promise<void> {
    if (!containerInfo) containerInfo = await container.inspect();

    // op is done, get logs from container and save them in the flow
    const log = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
    });
    const logs: OpState['logs'] = [];

    // parse output
    const output = this.demuxOutput(log);
    updateOpState({ logs });

    for (let i = 0; i < output.length; i++) {
      logs.push({
        type: output[i].type as 'stderr' | 'stdin' | 'stdout',
        log: output[i].log,
      });
      updateOpState({ logs });
    }

    updateOpState({
      exitCode: containerInfo.State.ExitCode,
      status: containerInfo.State.ExitCode ? 'failed' : 'success',
      endTime: Math.floor(new Date(containerInfo.State.FinishedAt).getTime()),
    });
  }

  private async handleLogStreams(
    container: Docker.Container | string,
    callback: Function,
    retries?: number,
  ) {
    await new Promise<void>(async (resolve, reject) => {
      // TODO: now made with retries, check if there's a better solution..
      if (!this.isDockerContainer(container)) {
        const c = await this.getContainerByName(container);
        if (c) {
          container = this.docker.getContainer(c.Id);
        } else {
          if (retries && retries > 0) {
            await sleep(1);
            await this.handleLogStreams(container, callback, retries - 1);
          } else {
            reject();
          }
        }
      }

      if (this.isDockerContainer(container)) {
        const stdoutStream = new stream.PassThrough();
        const stderrStream = new stream.PassThrough();

        stderrStream.on('data', (chunk: Buffer) => {
          callback({
            type: 'stderr',
            log: chunk.toString(),
          });
        });

        stdoutStream.on('data', (chunk: Buffer) => {
          callback({
            type: 'stdout',
            log: chunk.toString(),
          });
        });

        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
        });
        container.modem.demuxStream(logStream, stdoutStream, stderrStream);

        logStream.on('end', async () => {
          stdoutStream.end();
          stderrStream.end();
          resolve();
        });
      }
    });
  }

  public async clearFlow(flowId: string): Promise<void> {
    const flow = this.getFlow(flowId) as Flow;
    // for every op in flow, stop & remove container
    for (let j = 0; j < flow.state.opStates.length; j++) {
      const op = flow.state.opStates[j];
      if (op.providerId) {
        try {
          const c = await this.getContainerByName(op.providerId);
          if (c) {
            const container = this.docker.getContainer(c.Id);
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) {
              await container.stop();
            }
            await container.remove();
          }
        } catch (err: any) {
          console.error(`couldnt stop container ${op.providerId} - ${err}`);
        }
      }
    }
    super.clearFlow(flowId);
  }

  public async finishFlow(
    flowId: string,
    status?: string | undefined,
  ): Promise<void> {
    super.finishFlow(flowId, status);
    await this.pruneVolumes();
  }

  /****************
   *   Getters   *
   ****************/
  private async getContainerByName(
    name: string,
  ): Promise<Docker.ContainerInfo | undefined> {
    const opts = {
      limit: 1,
      filters: `{"name": ["${name}"]}`,
    };

    return new Promise(async (resolve, reject) => {
      await this.docker.listContainers(opts, (err, containers) => {
        if (err) {
          reject(err);
        } else {
          resolve(containers && containers[0]);
        }
      });
    });
  }

  /****************
   *   Helpers   *
   ****************/
  /**
   * input: log Buffer, output stdout & stderr strings
   * @param buffer
   * @returns
   */
  private demuxOutput = (buffer: Buffer): { type: string; log: string }[] => {
    const output = [];

    function bufferSlice(end: number) {
      const out = buffer.slice(0, end);
      buffer = Buffer.from(buffer.slice(end, buffer.length));
      return out;
    }

    while (buffer.length > 0) {
      const header = bufferSlice(8);
      const nextDataType = header.readUInt8(0);
      const nextDataLength = header.readUInt32BE(4);
      const content = bufferSlice(nextDataLength);
      switch (nextDataType) {
        case 1:
          output.push({
            type: 'stdout',
            log: Buffer.concat([content]).toString('utf8'),
          });
          break;
        case 2:
          output.push({
            type: 'stderr',
            log: Buffer.concat([content]).toString('utf8'),
          });
          break;
        default:
        // ignore
      }
    }

    return output;
  };

  private isDockerContainer(obj: any): obj is Docker.Container {
    return obj.modem !== undefined;
  }
}
