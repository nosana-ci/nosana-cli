import { randomUUID } from 'crypto';
import { Operation } from '../../../providers/Provider.js';
import { ContainerOrchestrationInterface } from './containerOrchestration/interface.js';
import { Flow, Log, OperationArgsMap, Resource } from './types.js';
import { applyLoggingProxyToClass } from '../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../repository/NodeRepository.js';
import { promiseTimeoutWrapper } from '../../../generic/timeoutPromiseWrapper.js';
import { extractLogsAndResultsFromLogBuffer } from '../../../providers/utils/extractLogsAndResultsFromLogBuffer.js';
import { ResourceManager } from '../node/resource/resourceManager.js';
import Dockerode from 'dockerode';
import { jobEmitter } from '../node/job/jobHandler.js';
import { s3HelperImage } from '../../../providers/modules/resourceManager/volumes/definition/s3HelperOpts.js';
import { configs } from '../configs/configs.js';

export class Provider {
  constructor(
    private containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
    private resourceManager: ResourceManager,
  ) {
    applyLoggingProxyToClass(this);
  }

  public async stopReverseProxyApi(address: string): Promise<boolean> {
    const tunnel_name = `tunnel-api-${address}`;
    const frpc_name = `frpc-api-${address}`;
    const networkName = `api-${address}`;

    try {
      let status, error, result;

      // Check if the tunnel container exists and stop/delete it
      ({ status, error, result } =
        await this.containerOrchestration.doesContainerExist(tunnel_name));
      if (status && result) {
        ({ status, error, result } =
          await this.containerOrchestration.stopAndDeleteContainer(
            tunnel_name,
          ));
        if (!status) throw error;
      }

      // Check if the frpc container exists and stop/delete it
      ({ status, error, result } =
        await this.containerOrchestration.doesContainerExist(frpc_name));
      if (status && result) {
        ({ status, error, result } =
          await this.containerOrchestration.stopAndDeleteContainer(frpc_name));
        if (!status) throw error;
      }

      // check if network then delete
      if (await this.containerOrchestration.hasNetwork(networkName)) {
        await this.containerOrchestration.deleteNetwork(networkName);
      }
    } catch (error) {
      throw error;
    }

    return true;
  }

  // set up reverse proxy api for api handler
  public async setUpReverseProxyApi(address: string): Promise<boolean> {
    const frpcImage = 'registry.hub.docker.com/nosana/frpc:0.1.0';
    const tunnelImage = 'registry.hub.docker.com/nosana/tunnel:0.1.0';
    try {
      let result;

      const networkName = `api-${address}`;
      const tunnel_port = 3000;
      const tunnel_name = `tunnel-api-${address}`;
      const frpc_name = `frpc-api-${address}`;

      let { status, error } = await this.containerOrchestration.createNetwork(
        networkName,
      );
      if (!status) {
        throw error;
      }

      const networks: { [key: string]: {} } = {};
      networks[networkName] = {};

      ({ status, error } = await this.containerOrchestration.pullImage(
        frpcImage,
      ));
      if (!status) {
        throw error;
      }

      ({ status, error } = await this.containerOrchestration.pullImage(
        tunnelImage,
      ));
      if (!status) {
        throw error;
      }

      ({ status, error, result } =
        await this.containerOrchestration.doesContainerExist(tunnel_name));
      if (!status) {
        throw error;
      }

      if (!result) {
        ({ status, error, result } =
          await this.containerOrchestration.runFlowContainer(tunnelImage, {
            name: tunnel_name,
            networks,
            env: {
              PORT: tunnel_port.toString(),
            },
          }));
        if (!status) {
          throw error;
        }
      } else {
        ({ status, error, result } =
          await this.containerOrchestration.isContainerExited(tunnel_name));
        if (!status) {
          throw error;
        }

        if (result) {
          ({ status, error, result } =
            await this.containerOrchestration.stopAndDeleteContainer(
              tunnel_name,
            ));
          if (!status) {
            throw error;
          }

          ({ status, error, result } =
            await this.containerOrchestration.runFlowContainer(tunnelImage, {
              name: tunnel_name,
              networks,
              env: {
                PORT: tunnel_port.toString(),
              },
            }));
          if (!status) {
            throw error;
          }
        }
      }
      ({ status, error, result } =
        await this.containerOrchestration.doesContainerExist(frpc_name));
      if (!status) {
        throw error;
      }

      if (!result) {
        ({ status, error, result } =
          await this.containerOrchestration.runFlowContainer(frpcImage, {
            name: 'frpc-api-' + address,
            cmd: ['-c', '/etc/frp/frpc.toml'],
            networks,
            restart_policy: 'on-failure',
            env: {
              FRP_SERVER_ADDR: configs().frp.serverAddr,
              FRP_SERVER_PORT: configs().frp.serverPort.toString(),
              FRP_NAME: 'API-' + address,
              FRP_LOCAL_IP: tunnel_name,
              FRP_LOCAL_PORT: tunnel_port.toString(),
              FRP_CUSTOM_DOMAIN: address + '.' + configs().frp.serverAddr,
            },
          }));
        if (!status) {
          throw error;
        }
      } else {
        ({ status, error, result } =
          await this.containerOrchestration.isContainerExited(frpc_name));
        if (!status) {
          throw error;
        }

        if (result) {
          ({ status, error, result } =
            await this.containerOrchestration.stopAndDeleteContainer(
              frpc_name,
            ));
          if (!status) {
            throw error;
          }

          ({ status, error, result } =
            await this.containerOrchestration.runFlowContainer(frpcImage, {
              name: 'frpc-api-' + address,
              cmd: ['-c', '/etc/frp/frpc.toml'],
              networks,
              restart_policy: 'on-failure',
              env: {
                FRP_SERVER_ADDR: configs().frp.serverAddr,
                FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                FRP_NAME: 'API-' + address,
                FRP_LOCAL_IP: tunnel_name,
                FRP_LOCAL_PORT: tunnel_port.toString(),
                FRP_CUSTOM_DOMAIN: address + '.' + configs().frp.serverAddr,
              },
            }));
          if (!status) {
            throw error;
          }
        }
      }
    } catch (error) {
      throw error;
    }
    return true;
  }

  private async startServiceExposedUrlHealthCheck(
    id: string,
    container: Dockerode.Container,
    port: number,
  ) {
    const interval = setInterval(async () => {
      try {
        const exec = await container.exec({
          Cmd: ['curl', '-s', `localhost:${port}`],
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ Detach: false, Tty: false });
        const output = await new Promise((resolve, reject) => {
          let result = '';
          stream.on('data', (data) => {
            result += data.toString();
          });
          stream.on('end', () => resolve(result));
          stream.on('error', reject);
        });

        if (output) {
          // raise an event
          jobEmitter.emit('run-exposed', { id });
          clearInterval(interval); // Stop further checks
        }
      } catch (error) {
        console.log(`Service on port ${port} not ready yet, retrying...`);
      }
    }, 2000);
  }

  async containerRunOperation(id: string, index: number): Promise<boolean> {
    const frpcImage = 'registry.hub.docker.com/nosana/frpc:0.1.0';

    const flow = this.repository.getflow(id);
    const opState = this.repository.getOpState(id, index);
    const op = flow.jobDefinition.ops[index] as Operation<'container/run'>;

    try {
      this.repository.updateOpState(id, index, {
        startTime: Date.now(),
        status: 'running',
      });

      let container = await this.containerOrchestration.getContainer(
        opState.providerId as string,
      );

      const exist = (
        await this.containerOrchestration.doesContainerExist(
          opState.providerId as string,
        )
      ).result;
      const exited = (
        await this.containerOrchestration.isContainerExited(
          opState.providerId as string,
        )
      ).result;

      if (exist && !exited && container.id) {
        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
        });

        logStream.on('data', (data) => {
          this.repository.updateOpStateLogs(id, index, data.toString());
        });
      } else {
        let result;
        let { status, error } = await this.containerOrchestration.pullImage(
          op.args.image,
        );
        if (!status) {
          throw error;
        }

        const name = flow.id + '-' + opState.operationId;
        const volumes = getVolumes(op.args, flow);
        const gpu = getGpu(op.args, flow);
        const entrypoint = getEntrypoint(op.args, flow);
        const work_dir = getWorkingDir(op.args, flow);
        const cmd = parseOpArgsCmd(op.args.cmd);
        const env = {
          ...getGlobalEnv(flow),
          ...op.args.env,
          NOSANA_ID: flow.id,
        };

        const networks: { [key: string]: {} } = {};

        if (op.args.expose) {
          networks[name] = {};

          ({ status, error } = await this.containerOrchestration.createNetwork(
            name,
          ));
          if (!status) {
            throw error;
          }

          const exposedUrlSecret = randomUUID();
          this.repository.updateflowStateSecret(id, {
            exposedUrl: exposedUrlSecret,
          });
          const prefix = op.args.private ? exposedUrlSecret : flow.id;

          ({ status, error } = await this.containerOrchestration.pullImage(
            frpcImage,
          ));
          if (!status) {
            throw error;
          }

          ({ status, error, result } =
            await this.containerOrchestration.runFlowContainer(frpcImage, {
              name: 'frpc-' + name,
              cmd: ['-c', '/etc/frp/frpc.toml'],
              networks,
              env: {
                FRP_SERVER_ADDR: configs().frp.serverAddr,
                FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                FRP_NAME: name,
                FRP_LOCAL_IP: name,
                FRP_LOCAL_PORT: op.args.expose.toString(),
                FRP_CUSTOM_DOMAIN: prefix + '.' + configs().frp.serverAddr,
                NOSANA_ID: flow.id,
              },
            }));
          if (!status) {
            throw error;
          }

          // we will stream out a url for the job
          // link will be logged out if public
          const link = `https://${prefix}.${configs().frp.serverAddr}`;

          this.repository.updateflowStateSecret(flow.id, { url: link });
        }

        if (op.args.resources) {
          ({ status, error } = await this.containerOrchestration.pullImage(
            s3HelperImage,
          ));
          if (!status) {
            throw error;
          }

          const resourceVolumes = await this.resourceManager.getResourceVolumes(
            op.args.resources ?? [],
          );

          try {
            volumes.push(...resourceVolumes);
          } catch (error) {
            throw error;
          }
        }

        ({ status, error, result } =
          await this.containerOrchestration.runFlowContainer(
            op.args.image ?? flow.jobDefinition.global?.image!,
            {
              name,
              cmd,
              env,
              networks,
              gpu,
              entrypoint,
              work_dir,
              volumes,
            },
          ));

        if (!status) {
          throw error;
        }

        if (result) {
          container = result;
        }

        this.repository.updateOpState(id, index, {
          providerId: container.id,
        });

        if (!container) {
          throw new Error('provider failed to start container');
        }

        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
        });

        logStream.on('data', (data) => {
          this.repository.displayLog(data.toString());
        });

        if (op.args.expose) {
          await this.startServiceExposedUrlHealthCheck(
            id,
            container,
            op.args.expose,
          );
        }

        await container.wait();

        const controller = new AbortController();

        const info = await promiseTimeoutWrapper(
          container.inspect({
            abortSignal: controller.signal,
          }),
          360,
          controller,
        );

        const logBuffer = await promiseTimeoutWrapper(
          container.logs({
            stdout: true,
            stderr: true,
            follow: false,
            abortSignal: controller.signal,
          }),
          360,
          controller,
        );

        const { logs, results } = extractLogsAndResultsFromLogBuffer(
          logBuffer,
          op.results,
        );

        this.repository.updateOpState(id, index, {
          logs,
          results,
          status: info.State.ExitCode ? 'failed' : 'success',
          exitCode: info.State.ExitCode,
          endTime: Math.floor(new Date(info.State.FinishedAt).getTime()),
        });
      }
    } catch (error) {
      this.repository.updateOpState(id, index, {
        exitCode: 2,
        status: 'failed',
        endTime: Date.now(),
        logs: [
          {
            type: 'nodeerr',
            log: `${error}`,
          },
        ],
      });
      return false;
    }

    return true;
  }

  async containerRunStopOperation(id: string, index: number): Promise<boolean> {
    const flow = this.repository.getflow(id);
    const opState = this.repository.getOpState(id, index);

    const name = flow.id + '-' + opState.operationId;

    const containers = await this.containerOrchestration.getContainersByName([
      name,
      'frpc-' + name,
    ]);

    for (let c of containers) {
      await this.containerOrchestration.stopAndDeleteContainer(c.id);
    }
    await this.containerOrchestration.deleteNetwork(name);

    return true;
  }

  async volumeCreateOperation(id: string, index: number): Promise<boolean> {
    const flow = this.repository.getflow(id);
    const op = flow.jobDefinition.ops[
      index
    ] as Operation<'container/create-volume'>;

    try {
      this.repository.updateOpState(id, index, {
        startTime: Date.now(),
        status: 'running',
      });

      const name = flow.id + '-' + op.args.name;
      let { status, result, error } =
        await this.containerOrchestration.getVolume(name);

      if (!status) {
        let { status, result, error } =
          await this.containerOrchestration.createVolume(name);

        if (!status) {
          throw error;
        }

        this.repository.updateOpState(id, index, {
          status: 'success',
          endTime: Date.now(),
          exitCode: 0,
          providerId: result?.Name,
        });
      }
    } catch (error) {
      this.repository.updateOpState(id, index, {
        exitCode: 2,
        status: 'failed',
        endTime: Date.now(),
        logs: [
          {
            type: 'nodeerr',
            log: `${error}`,
          },
        ],
      });
      return false;
    }
    return true;
  }

  async volumeStopOperation(id: string, index: number): Promise<boolean> {
    const flow = this.repository.getflow(id);
    const opState = this.repository.getOpState(id, index);

    const name = flow.id + '-' + opState.operationId;
    let { status, result, error } =
      await this.containerOrchestration.deleteVolume(name);

    return true;
  }

  public runOperation(
    type: string,
    param: { id: string; index: number; name: string },
  ): Promise<boolean> {
    if (type == 'container/run') {
      return this.containerRunOperation(param.id, param.index);
    }
    if (type == 'container/create-volume') {
      return this.volumeCreateOperation(param.id, param.index);
    }
    throw new Error('function not supported');
  }

  public stopOperation(
    type: string,
    param: { id: string; index: number; name: string },
  ): Promise<boolean> {
    if (type == 'container/run') {
      return this.containerRunStopOperation(param.id, param.index);
    }
    if (type == 'container/create-volume') {
      return this.volumeStopOperation(param.id, param.index);
    }
    throw new Error('function not supported');
  }
}

export function parseOpArgsCmd(
  cmd: OperationArgsMap['container/run']['cmd'],
): string[] | undefined {
  if (typeof cmd !== 'string') return cmd;
  return ['/bin/sh', '-c', cmd];
}

function getGlobalEnv(flow: Flow) {
  return flow.jobDefinition.global && flow.jobDefinition.global.env
    ? flow.jobDefinition.global.env
    : {};
}

function getWorkingDir(arg: OperationArgsMap['container/run'], flow: Flow) {
  return arg.work_dir ||
    !flow.jobDefinition.global ||
    !flow.jobDefinition.global.work_dir
    ? arg.work_dir
    : flow.jobDefinition.global.work_dir;
}

function getEntrypoint(arg: OperationArgsMap['container/run'], flow: Flow) {
  return arg.entrypoint ||
    !flow.jobDefinition.global ||
    !flow.jobDefinition.global.entrypoint
    ? arg.entrypoint
    : flow.jobDefinition.global.entrypoint;
}

function getGpu(arg: OperationArgsMap['container/run'], flow: Flow) {
  return (
    arg.gpu || (flow.jobDefinition.global && flow.jobDefinition.global.gpu)
  );
}

function getVolumes(arg: OperationArgsMap['container/run'], flow: Flow) {
  const volumes: { dest: string; name: string; readonly?: boolean }[] = [];

  if (arg.volumes && arg.volumes.length > 0) {
    for (let i = 0; i < arg.volumes.length; i++) {
      const volume = arg.volumes[i];
      volumes.push({
        dest: volume.dest,
        name: flow.id + '-' + volume.name,
      });
    }
  }
  return volumes;
}
