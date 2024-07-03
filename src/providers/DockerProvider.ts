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
import Docker, {
  Container,
  ContainerCreateOptions,
  MountType,
} from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import { BasicProvider } from './BasicProvider.js';
import { sleep } from '../generic/utils.js';
import { getSDK } from '../services/sdk.js';
import { extractResultsFromLogs } from './utils/extractResultsFromLogs.js';
import { config } from '../config/index.js';

export type RunContainerArgs = {
  name?: string;
  networks?: { [key: string]: {} };
  cmd?: string[];
  gpu?: boolean;
  volumes?: Array<{
    dest: string;
    name: string;
  }>;
  env?: { [key: string]: string };
  work_dir?: string;
  entrypoint?: string | string[];
};

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
      let container: Container | undefined;
      // Check if we already have a container running for this operation
      if (opState.providerId) {
        try {
          container = this.docker.getContainer(opState.providerId as string);
        } catch (error) {
          updateOpState({ providerId: null });
        }
      }
      if (!opState.providerId) {
        updateOpState({
          startTime: Date.now(),
          status: 'running',
        });
        try {
          await this.pullImage(op.args.image);
        } catch (error: any) {
          throw new Error(
            chalk.red(`Cannot pull image ${op.args.image}: `) + error,
          );
        }
        if (op.args.expose) {
          const frpcImage = 'docker.io/laurensv/nosana-frpc';
          try {
            await this.pullImage(frpcImage);
          } catch (error: any) {
            throw new Error(
              chalk.red(`Cannot pull image ${frpcImage}: `) + error,
            );
          }
        }

        container = await this.executeCmd(
          op.args,
          flowId,
          opStateIndex,
          updateOpState,
        );
      }
      if (container) {
        await container.wait();
        await this.finishOpContainerRun({
          container,
          updateOpState,
          operationResults,
        });
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
      this.eventEmitter.emit('newLog', {
        type: 'info',
        log: chalk.cyan(`- Creating volume ${chalk.bold(op.args.name)}`),
      });
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
      const info = await this.docker.info();
      if (typeof info === 'object' && info !== null && info.ID) {
        return true;
      } else {
        if (throwError) {
          throw "Can't recognize podman or docker";
        }
        return false;
      }
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
  ): Promise<Container> {
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

    // create volume mount array
    const volumes = [];
    if (opArgs.volumes && opArgs.volumes.length > 0) {
      for (let i = 0; i < opArgs.volumes.length; i++) {
        const volume = opArgs.volumes[i];
        volumes.push({
          dest: volume.dest,
          name: flowId + '-' + volume.name,
        });
      }
    }

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

    const globalEnv =
      flow.jobDefinition.global && flow.jobDefinition.global.env
        ? flow.jobDefinition.global.env
        : {};
    this.eventEmitter.emit('newLog', {
      type: 'info',
      log: chalk.cyan('Starting container'),
    });
    const name = flowId + '-' + flow.state.opStates[opStateIndex].operationId;
    await this.docker.createNetwork({ Name: name });
    const networks: { [key: string]: {} } = {};
    networks[name] = {};
    const container: Container = await this.runContainer(
      opArgs.image ? opArgs.image : flow.jobDefinition.global?.image!,
      {
        name,
        cmd: parsedcmd as string[],
        env: {
          ...globalEnv,
          ...opArgs.env,
        },
        networks,
        gpu:
          opArgs.gpu ||
          (flow.jobDefinition.global && flow.jobDefinition.global.gpu),
        entrypoint,
        work_dir,
        volumes,
      },
    );
    updateOpState({ providerId: container.id });
    this.eventEmitter.emit('newLog', {
      type: 'info',
      log: chalk.cyan('Running container ' + container.id),
    });
    try {
      await this.streamingLogs(container);
    } catch (e) {
      console.error(e);
    }
    if (opArgs.expose) {
      await this.runContainer('docker.io/laurensv/nosana-frpc', {
        name: 'frpc-' + name,
        cmd: ['-c', '/etc/frp/frpc.toml'],
        networks,
        env: {
          FRP_SERVER_ADDR: config.frp.serverAddr,
          FRP_SERVER_PORT: config.frp.serverPort.toString(),
          FRP_NAME: name,
          FRP_LOCAL_IP: name,
          FRP_LOCAL_PORT: opArgs.expose.toString(),
          FRP_CUSTOM_DOMAIN: flowId + '.' + config.frp.serverAddr,
        },
      });
      this.eventEmitter.emit('newLog', {
        type: 'info',
        log: chalk.cyan(
          `Exposing service at ${chalk.bold(
            `https://${flowId}.${config.frp.serverAddr}`,
          )}`,
        ),
      });
    }
    return container;
  }

  public async runContainer(
    image: string,
    {
      name,
      networks,
      cmd,
      gpu,
      volumes,
      env,
      work_dir,
      entrypoint,
    }: RunContainerArgs,
  ): Promise<Container> {
    const devices = gpu
      ? [
          {
            Count: -1,
            Driver: 'nvidia',
            Capabilities: [['gpu']],
          },
        ]
      : [];
    const dockerVolumes = [];
    if (volumes && volumes.length > 0) {
      for (let i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        dockerVolumes.push({
          Target: volume.dest,
          Source: volume.name,
          Type: 'volume' as MountType,
          ReadOnly: false,
        });
      }
    }
    const vars: string[] = [];
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        vars.push(`${key}=${value}`);
      }
    }
    const optsc: ContainerCreateOptions = {
      name: name,
      Hostname: '',
      User: '',
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      Env: vars,
      Cmd: cmd,
      Image: image,
      WorkingDir: work_dir,
      Entrypoint: entrypoint,
      NetworkingConfig: {
        EndpointsConfig: networks,
      },
      HostConfig: {
        Mounts: dockerVolumes,
        NetworkMode: 'bridge',
        DeviceRequests: devices,
      },
    };

    const container = await this.docker.createContainer(optsc);
    await container.start();
    return container;
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

  public async stopFlowOperation(
    flowId: string,
    op: Operation<any>,
  ): Promise<OpState> {
    const opState = this.db.data.flows[flowId].state.opStates.find(
      (opState) => opState.operationId === op.id,
    );
    if (!opState) throw new Error('could not find opState');
    if (opState.providerId) {
      const container = this.docker.getContainer(opState.providerId);
      try {
        await container.stop();
      } catch (e) {
        // Couldn't stop container
      }
    }

    return opState;
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

  public async finishFlow(
    flowId: string,
    status?: string | undefined,
  ): Promise<void> {
    const flow = this.getFlow(flowId) as Flow;

    // first remove all containers
    let totalLogLines = 0;
    for (let i = 0; i < flow?.state.opStates.length; i++) {
      // Quick fix to limit log size. TODO: figure out a better way
      if (flow.state.opStates[i].logs && totalLogLines !== -1) {
        totalLogLines += flow.state.opStates[i].logs.length;
      }

      if (totalLogLines > 25000 || totalLogLines === -1) {
        if (totalLogLines !== -1) {
          flow.state.opStates[i].logs = flow.state.opStates[i].logs.slice(0, 5);
          totalLogLines = -1;
          flow.state.opStates[i].logs.push({
            type: 'nodeerr',
            log: 'I: logs cut off, too long..',
          });
        } else {
          flow.state.opStates[i].logs = [
            {
              type: 'nodeerr',
              log: 'I: logs cut off, too long..',
            },
          ];
        }
        this.db.write();
      }

      if (flow.state.opStates[i].providerId) {
        await this.stopAndRemoveContainer(
          flow.state.opStates[i].providerId as string,
        );
        const frpcName =
          'frpc-' + flowId + '-' + flow.state.opStates[i].operationId;
        await this.stopAndRemoveContainer(frpcName);
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
    try {
      await this.docker.pruneNetworks();
    } catch (error: any) {
      // console.error(
      //   chalk.red('couldnt remove networks'),
      //   error.message ? error.message : error,
      // );
    }
    super.finishFlow(flowId, status);
  }

  /****************
   *   Helpers   *
   ****************/
  protected async pullImage(image: string) {
    this.eventEmitter.emit('newLog', {
      type: 'info',
      log: chalk.cyan(`Pulling image ${chalk.bold(image)}`),
    });
    const images = await this.docker.listImages();
    if (!image.includes(':')) image += ':latest';
    for (var i = 0, len = images.length; i < len; i++) {
      if (
        images[i].RepoTags &&
        (images[i].RepoTags?.indexOf(image) !== -1 ||
          images[i].RepoTags?.indexOf('docker.io/library/' + image) !== -1 ||
          images[i].RepoTags?.indexOf('docker.io/' + image) !== -1 ||
          images[i].RepoTags?.indexOf(
            'registry.hub.docker.com/library/' + image,
          ) !== -1 ||
          images[i].RepoTags?.indexOf('registry.hub.docker.com/' + image) !==
            -1)
      ) {
        // image in cache
        return true;
      }
    }
    return await new Promise((resolve, reject): any =>
      this.docker.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
        } else {
          this.docker.modem.followProgress(stream, onFinished, onProgress);
        }
        function onFinished(err: any, output: any) {
          if (!err) {
            resolve(true);
            return;
          }
          reject(err);
        }
        function onProgress(event: any) {
          // TODO: multiple progress bars happening at the same time, how do we show this?
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
        const container = this.docker.getContainer(providerId);
        const containerInfo = await container.inspect();
        if (containerInfo.State.Running) {
          await container.kill();
        } else {
          await container.remove();
        }
      } catch (err: any) {
        // console.error(
        //   `couldnt stop or remove container ${providerId} - ${err}`,
        // );
      }
    }
  }

  private async streamingLogs(container: Container) {
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    stderrStream.on('data', (chunk: Buffer) => {
      this.eventEmitter.emit('newLog', {
        type: 'stderr',
        log: chunk.toString(),
      });
    });
    stdoutStream.on('data', (chunk: Buffer) => {
      this.eventEmitter.emit('newLog', {
        type: 'stdout',
        log: chunk.toString(),
      });
    });
    try {
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
      });
      container.modem.demuxStream(logStream, stdoutStream, stderrStream);
      logStream.on('end', async () => {
        stdoutStream.end();
        stderrStream.end();
      });
    } catch (e) {
      stdoutStream.end();
      stderrStream.end();
      throw e;
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
