import chalk from 'chalk';
import stream from 'stream';
import { sleep } from '@nosana/sdk';
import Docker, {
  Container,
  ContainerCreateOptions,
  MountSettings,
} from 'dockerode';

import { BasicProvider } from './BasicProvider.js';
import {
  Operation,
  Provider,
  OpState,
  Flow,
  OperationArgsMap,
  OperationResults,
  ProviderEvents,
  Log,
  OperationType,
} from './Provider.js';
import { config } from '../generic/config.js';
import { getSDK } from '../services/sdk.js';
import { extractResultsFromLogs } from './utils/extractResultsFromLogs.js';
import { parseOpArgsCmd } from './utils/parseOpsArgsCmd.js';
import { createResourceManager } from './modules/resourceManager/index.js';
import { DockerExtended } from '../docker/index.js';
import { s3HelperImage } from './modules/resourceManager/volumes/definition/s3HelperOpts.js';
import Logger from './modules/logger/index.js';
import { createSeverObject } from './utils/createServerObject.js';

export type RunContainerArgs = {
  name?: string;
  networks?: { [key: string]: {} };
  cmd?: string[];
  gpu?: boolean;
  network_mode?: 'bridge' | 'host' | 'none';
  volumes?: Array<{
    dest: string;
    name: string;
    readonly?: boolean;
  }>;
  env?: { [key: string]: string };
  work_dir?: string;
  entrypoint?: string | string[];
};

export const FRPC_IMAGE = 'registry.hub.docker.com/nosana/frpc:0.1.0';

export class DockerProvider extends BasicProvider implements Provider {
  public docker: DockerExtended;
  protected resourceManager;
  public host: string;
  public port: string;
  public protocol: 'https' | 'http' | 'ssh';
  public name: string = 'docker';

  constructor(server: string, configLocation: string, logger?: Logger) {
    super(configLocation, logger);

    const { host, port, protocol } = createSeverObject(server);

    this.host = host;
    this.port = port;
    this.protocol = protocol;

    this.docker = new DockerExtended({
      host: this.host,
      port: this.port,
      protocol: this.protocol,
    });

    this.resourceManager = createResourceManager(
      this.db,
      this.docker,
      this.logger,
    );

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
          try {
            await this.streamingLogs(container);
          } catch (e) {
            // console.error(e);
          }
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
          try {
            await this.pullImage(FRPC_IMAGE);
          } catch (error: any) {
            throw new Error(
              chalk.red(`Cannot pull image ${FRPC_IMAGE}: `) + error,
            );
          }
        }

        if (op.args.resources) {
          try {
            await this.pullImage(s3HelperImage);
          } catch (error) {
            throw new Error(
              chalk.red(`Cannot pull image ${s3HelperImage}: `) + error,
            );
          }
          for (const resource of op.args.resources) {
            try {
              await this.resourceManager.volumes.createRemoteVolume(resource);
            } catch (err) {
              throw new Error(
                chalk.red(`Cannot pull remote resource ${resource.url}:\n`) +
                  err,
              );
            }
          }
        }

        // Allow file locks to reset - hopefully will reduce image not known issue
        await sleep(3);

        container = await this.runOpContainerRun(
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
      this.logger.log(
        chalk.cyan(`- Creating volume ${chalk.bold(op.args.name)}`),
        true,
      );
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

  public async getContainer(id: string): Promise<Docker.Container> {
    return this.docker.getContainer(id);
  }

  /**
   * Check if DockerProvider is healthy by checking if podman is running
   * @returns boolean
   */
  public async healthy(throwError: Boolean = true): Promise<Boolean> {
    try {
      const info = await this.docker.info();
      if (typeof info === 'object' && info !== null && info.ID) {
        await this.resourceManager.resyncResourcesDB();
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
   * Create the containers neccesary for a container/run operation.
   * Returns the main container
   * @param opArgs
   * @param flowId
   * @param opStateIndex
   * @param updateOpState
   * @returns
   */
  async runOpContainerRun(
    opArgs: OperationArgsMap['container/run'],
    flowId: string,
    opStateIndex: number,
    updateOpState: Function,
  ): Promise<Container> {
    const flow = this.getFlow(flowId) as Flow;
    const parsedCmd = parseOpArgsCmd(opArgs.cmd);

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

    // Get remote resources and attach as volume
    if (opArgs.resources) {
      for (const resource of opArgs.resources) {
        if (
          (await this.resourceManager.volumes.hasVolume(resource.url)) === false
        ) {
          throw new Error(`Missing required resource ${resource.url}.`);
        }

        volumes.push({
          dest: resource.target,
          name: (await this.resourceManager.volumes.getVolume(resource.url))!,
          readonly: true,
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
    this.logger.log(chalk.cyan('Starting container'), true);
    const name = flowId + '-' + flow.state.opStates[opStateIndex].operationId;
    await this.docker.createNetwork({ Name: name });
    const networks: { [key: string]: {} } = {};
    networks[name] = {};
    const container: Container = await this.runContainer(
      opArgs.image ? opArgs.image : flow.jobDefinition.global?.image!,
      {
        name,
        cmd: parsedCmd as string[],
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
    this.logger.log(chalk.cyan('Running container ' + container.id), true);
    try {
      await this.streamingLogs(container);
    } catch (e) {
      // console.error(e);
    }
    if (opArgs.expose) {
      await this.runContainer(FRPC_IMAGE, {
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
      this.logger.log(
        chalk.cyan(
          `Exposing service at ${chalk.bold(
            `https://${flowId}.${config.frp.serverAddr}`,
          )}`,
        ),
      );
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
      network_mode,
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
    const dockerVolumes: MountSettings[] = [];
    if (volumes && volumes.length > 0) {
      for (let i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        dockerVolumes.push({
          Target: volume.dest,
          Source: volume.name,
          Type: 'volume',
          ReadOnly: volume.readonly || false,
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
        NetworkMode: network_mode || 'bridge',
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
    op: Operation<OperationType>,
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

  async updateMarketRequiredResources(market: string): Promise<void> {
    await this.resourceManager.fetchMarketRequiredResources(market);
  }

  /****************
   *   Helpers   *
   ****************/
  public async pullImage(image: string) {
    if (await this.docker.hasImage(image)) {
      this.resourceManager.images.setImage(image);

      return true;
    }

    this.logger.log(chalk.cyan(`Pulling image ${chalk.bold(image)}`));

    await this.docker.promisePull(image);

    this.resourceManager.images.setImage(image);
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

  public async stopAndRemoveContainer(containerId: string) {
    if (containerId) {
      try {
        const container = this.docker.getContainer(containerId);
        const containerInfo = await container.inspect();
        if (containerInfo.State.Running) {
          await container.kill();
          await container.remove();
        } else {
          await container.remove();
        }
      } catch (err: any) {
        // console.error(
        //   `couldnt stop or remove container ${containerId} - ${err}`,
        // );
      }
    }
  }

  private async streamingLogs(container: Container) {
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    stderrStream.on('data', (chunk: Buffer) => {
      this.logger.emit(ProviderEvents.CONTAINER_LOG, {
        type: 'stderr',
        log: chunk.toString(),
      });
    });
    stdoutStream.on('data', (chunk: Buffer) => {
      this.logger.emit(ProviderEvents.CONTAINER_LOG, {
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
}
