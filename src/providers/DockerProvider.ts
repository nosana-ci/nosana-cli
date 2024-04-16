import chalk from 'chalk';
import {
  Operation,
  Provider,
  OpState,
  Flow,
  OperationArgsMap,
  OperationResults,
  Log,
} from './Provider.js';
import Docker, { MountType } from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import { BasicProvider } from './BasicProvider.js';
import { sleep } from '../generic/utils.js';
import { getSDK } from '../services/sdk.js';
import { extractResultsFromLogs } from './utils/extractResultsFromLogs.js';

export class DockerProvider extends BasicProvider implements Provider {
  protected docker: Docker;
  protected host: string;
  protected port: string;
  protected protocol: string;

  constructor(server: string, configLocation: string) {
    super(configLocation);
    const serverUri = new URL(
      server.startsWith('http') || server.startsWith('ssh')
        ? server
        : `http://${server}`,
    );
    const protocol = serverUri.protocol.replace(':', '');
    if (
      !['https', 'http', 'ssh'].includes(protocol) &&
      typeof protocol !== 'undefined'
    ) {
      throw new Error(`Protocol ${protocol} not supported`);
    }

    this.host = serverUri.hostname;
    this.port = serverUri.port;
    this.protocol = protocol;
    this.docker = new Docker({
      host: this.host,
      port: this.port,
      protocol: this.protocol as 'https' | 'http' | 'ssh' | undefined,
    });

    /**
     * Run operation and return results
     * @param op Operation specs
     * @returns OpState
     */
    this.supportedOps['container/run'] = async (
      op: Operation<'container/run'>,
      flowId: string,
      updateOpState: Function,
      operationResults: OperationResults | undefined,
    ): Promise<OpState> => {
      const flow = this.getFlow(flowId) as Flow;
      const opStateIndex = flow.state.opStates.findIndex(
        (opState) => op.id === opState.operationId,
      );
      const opState = flow.state.opStates[opStateIndex];
      if (opState.providerId) {
        const c = await this.getContainerByName(opState.providerId as string);

        // when node is shutted down before the container started, it won't find the container
        // clear providerId so that it will be ran again
        if (!c) {
          updateOpState({ providerId: null });
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

            await this.finishOpContainerRun({
              container,
              updateOpState,
              containerInfo,
              operationResults,
            });
          } else if (containerInfo.State.Status === 'exited') {
            await this.finishOpContainerRun({
              container,
              updateOpState,
              containerInfo,
              operationResults,
            });
          }
        }
      }
      if (!opState.providerId) {
        updateOpState({
          startTime: Date.now(),
          status: 'running',
        });
        console.log(chalk.cyan(`Executing step ${chalk.bold(op.id)}`));
        try {
          console.log(
            chalk.cyan(`- Pulling image ${chalk.bold(op.args.image)}`),
          );
          await this.pullImage(op.args.image);
        } catch (error: any) {
          throw new Error(
            chalk.red(`Cannot pull image ${op.args.image}: `) + error,
          );
        }

        await this.executeCmd(
          op.args,
          flowId,
          opStateIndex,
          updateOpState,
          operationResults,
        );
      }

      return opState;
    };

    /**
     * Create volume
     * @param op Operation specs
     */
    this.supportedOps['container/create-volume'] = async (
      op: Operation<'container/create-volume'>,
      flowId: string,
      updateOpState: Function,
    ): Promise<OpState> => {
      const flow = this.getFlow(flowId) as Flow;
      const opStateIndex = flow.state.opStates.findIndex(
        (opState) => op.id === opState.operationId,
      );
      const opState = flow.state.opStates[opStateIndex];
      console.log(chalk.cyan(`Executing step ${chalk.bold(op.id)}`));
      console.log(chalk.cyan(`- Creating volume ${chalk.bold(op.args.name)}`));
      updateOpState({
        startTime: Date.now(),
        status: 'running',
      });

      return await new Promise(async (resolve, reject) => {
        this.docker.createVolume(
          {
            Name: flowId + '-' + op.args.name,
          },
          (err, volume) => {
            if (err) {
              updateOpState({
                endTime: Date.now(),
                status: 'failed',
                exitCode: 1,
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
              providerId: volume?.name,
              endTime: Date.now(),
              exitCode: 0,
              status: 'success',
            });
            resolve(opState);
          },
        );
      });
    };
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
   * Perform docker.run for given cmd, return logs
   * @param opArgs
   * @param flowId
   * @param opStateIndex
   * @returns
   */
  async executeCmd(
    opArgs: OperationArgsMap['container/run'],
    flowId: string,
    opStateIndex: number,
    updateOpState: Function,
    operationResults: OperationResults | undefined,
  ): Promise<OpState> {
    return await new Promise<OpState>(async (resolve, reject) => {
      let cmd = '';
      if (Array.isArray(opArgs.cmd)) {
        for (let i = 0; i < opArgs.cmd.length; i++) {
          if (i === 0) {
            cmd += opArgs.cmd[i];
          } else {
            cmd += "'" + opArgs.cmd[i] + "'";
          }
        }
      } else {
        cmd = opArgs.cmd;
      }
      const flow = this.getFlow(flowId) as Flow;
      const parsedcmd = parse(cmd);

      const name = [...Array(32)]
        .map(() => Math.random().toString(36)[2])
        .join('');
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
            Source: flowId + '-' + volume.name,
            Type: 'volume' as MountType,
            ReadOnly: false,
          });
        }
      }

      // pass stream, but we are not using it, as we are using handleLogStreams
      const emptyStream = new stream.PassThrough();

      // check for global & local options
      const work_dir =
        opArgs.work_dir ||
        !flow.jobDefinition.global ||
        !flow.jobDefinition.global.work_dir
          ? opArgs.work_dir
          : flow.jobDefinition.global.work_dir;

      const entrypoint =
        opArgs.entrypoint ||
        !flow.jobDefinition.global ||
        !flow.jobDefinition.global.entrypoint
          ? opArgs.entrypoint
          : flow.jobDefinition.global.entrypoint;

      const devices =
        opArgs.gpu ||
        (flow.jobDefinition.global && flow.jobDefinition.global.gpu)
          ? [
              {
                Count: -1,
                Driver: 'nvidia',
                Capabilities: [['gpu']],
              },
            ]
          : [];

      const globalEnv =
        flow.jobDefinition.global && flow.jobDefinition.global.env
          ? flow.jobDefinition.global.env
          : {};
      const vars = [];
      for (const [key, value] of Object.entries({
        ...globalEnv,
        ...opArgs.env,
      })) {
        vars.push(`${key}=${value}`);
      }
      console.log(
        chalk.cyan(`- Running command  ${chalk.bold(parsedcmd.join(' '))}`),
      );

      return await this.docker
        .run(opArgs.image, parsedcmd as string[], emptyStream, {
          name,
          Tty: false,
          Env: vars,
          Entrypoint: entrypoint,
          HostConfig: {
            Mounts: volumes,
            DeviceRequests: devices,
          },
          WorkingDir: work_dir,
        })
        .then(async ([res, container]) => {
          await this.finishOpContainerRun({
            container,
            updateOpState,
            operationResults,
          });
          emptyStream.end();
          resolve(flow.state.opStates[opStateIndex]);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  protected hookPreRun(flow: Flow): Flow {
    for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
      const op = flow.jobDefinition.ops[i];
      if (op.type === 'container/run') {
        const args = op.args as OperationArgsMap['container/run'];
        if (args.output) {
          const outputVolume = `output-${op.id}`;
          const volume = {
            dest: args.output,
            name: outputVolume,
          };
          if (!args.volumes) args.volumes = [volume];
          else args.volumes.push(volume);
          const createVolumeOperation: Operation<'container/create-volume'> = {
            type: 'container/create-volume',
            id: 'create-output-volume',
            args: {
              name: outputVolume,
            },
          };
          flow.jobDefinition.ops.splice(i, 0, createVolumeOperation);
          const nosana = getSDK();
          const outputOperation: Operation<'container/run'> = {
            type: 'container/run',
            id: 'create-output-artifact',
            args: {
              image: 'docker.io/nosana/nosana-node-helper:latest',
              env: {
                SECRETS_MANAGER: nosana.secrets.config.manager,
                SECRETS_TOKEN: 'TODO-make-secrets-token-optional',
                PINATA_JWT: nosana.ipfs.config.jwt!,
                RUST_BACKTRACE: '1',
                RUST_LOG: 'info',
              },
              volumes: [
                {
                  name: outputVolume,
                  dest: '/nosana-ci/outputs',
                },
              ],
              cmd: `nosana-node-helper artifact-uploader --job-id ${outputVolume} --path /nosana-ci/outputs`,
            },
          };
          flow.jobDefinition.ops.splice(i + 2, 0, outputOperation);
          i = i + 2;
        }
      }
    }
    return flow;
  }

  /**
   * Finish container run, extract results and update opState
   * @param container
   * @param opState
   * @param containerInfo optional
   */
  protected async finishOpContainerRun({
    container,
    containerInfo,
    operationResults,
    updateOpState,
  }: {
    container: Docker.Container;
    containerInfo?: Docker.ContainerInspectInfo;
    operationResults?: OperationResults | undefined;
    updateOpState: Function;
  }): Promise<void> {
    if (!containerInfo) containerInfo = await container.inspect();

    // op is done, get logs from container and save them in the flow
    const log = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
    });
    const logs: OpState['logs'] = this.demuxOutput(log);
    const results: OpState['results'] = extractResultsFromLogs(
      logs,
      operationResults,
    );

    const updatedOpState: Partial<OpState> = {
      logs,
      exitCode: containerInfo.State.ExitCode,
      status: containerInfo.State.ExitCode ? 'failed' : 'success',
      endTime: Math.floor(new Date(containerInfo.State.FinishedAt).getTime()),
    };

    if (results) updatedOpState['results'] = results;

    updateOpState(updatedOpState);
  }

  protected async handleLogStreams(
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

  public async finishFlow(
    flowId: string,
    status?: string | undefined,
  ): Promise<void> {
    const flow = this.getFlow(flowId) as Flow;

    // first remove all containers
    for (let i = 0; i < flow?.jobDefinition.ops.length; i++) {
      if (flow.state.opStates[i].providerId) {
        await this.stopAndRemoveContainer(
          flow.state.opStates[i].providerId as string,
        );
      }
    }

    // then remove all volumes
    for (let i = 0; i < flow?.jobDefinition.ops.length; i++) {
      const op = flow?.jobDefinition.ops[i];
      if (op && op.type === 'container/create-volume') {
        try {
          const args = op.args as OperationArgsMap['container/create-volume'];
          await this.removeVolume(flow.id + '-' + args.name);
        } catch (error: any) {
          // console.error(
          //   chalk.red('couldnt remove volume'),
          //   error.message ? error.message : error,
          // );
        }
      }
    }
    super.finishFlow(flowId, status);
  }

  /****************
   *   Getters   *
   ****************/
  protected async getContainerByName(
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
  protected async pullImage(image: string) {
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
   * Remove volume
   * @returns
   */
  private async removeVolume(name: string) {
    return await new Promise<void>(async (resolve, reject): Promise<any> => {
      try {
        const volume = this.docker.getVolume(name);
        await volume.remove();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async stopAndRemoveContainer(providerId: string) {
    if (providerId) {
      try {
        const c = await this.getContainerByName(providerId);
        if (c) {
          const container = this.docker.getContainer(c.Id);
          const containerInfo = await container.inspect();
          if (containerInfo.State.Running) {
            // await container.stop();
            await container.kill();
          } else {
            await container.remove();
          }
        }
      } catch (err: any) {
        // console.error(
        //   `couldnt stop or remove container ${providerId} - ${err}`,
        // );
      }
    }
  }

  /**
   * input: log Buffer, output stdout & stderr strings
   * @param buffer
   * @returns demuxOutput
   */
  private demuxOutput = (buffer: Buffer): Log[] => {
    const output: Log[] = [];

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
