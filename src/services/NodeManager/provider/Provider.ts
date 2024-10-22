import { randomUUID } from 'crypto';
import { config } from '../../../generic/config.js';
import { ResourceManager } from '../../../providers/modules/resourceManager/index.js';
import { Operation } from '../../../providers/Provider.js';
import { FlowHandler } from '../node/flow/flowHandler.js';
import { ContainerOrchestrationInterface } from './containerOrchestration/interface.js';
import {
  Flow,
  FlowState,
  Log,
  OperationArgsMap,
  OperationResults,
  OpState,
  Resource,
} from './types.js';
import { createResourceName } from '../../../providers/modules/resourceManager/volumes/index.js';
import { extractResultsFromLogs } from '../../../providers/utils/extractResultsFromLogs.js';
import { applyLoggingProxyToClass, createLoggingProxy } from "../node/monitoring/proxy/loggingProxy.js";
import { NodeRepository } from "../repository/NodeRepository.js";

export class Provider {
  constructor(
    private containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
    private resourceManager: ResourceManager,
  ) {
    applyLoggingProxyToClass(this);
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
          await this.containerOrchestration.runContainer(tunnelImage, {
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
            await this.containerOrchestration.runContainer(tunnelImage, {
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
          await this.containerOrchestration.runContainer(frpcImage, {
            name: 'frpc-api-' + address,
            cmd: ['-c', '/etc/frp/frpc.toml'],
            networks,
            env: {
              FRP_SERVER_ADDR: config.frp.serverAddr,
              FRP_SERVER_PORT: config.frp.serverPort.toString(),
              FRP_NAME: 'API-' + address,
              FRP_LOCAL_IP: tunnel_name,
              FRP_LOCAL_PORT: tunnel_port.toString(),
              FRP_CUSTOM_DOMAIN: address + '.' + config.frp.serverAddr,
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
            await this.containerOrchestration.runContainer(frpcImage, {
              name: 'frpc-api-' + address,
              cmd: ['-c', '/etc/frp/frpc.toml'],
              networks,
              env: {
                FRP_SERVER_ADDR: config.frp.serverAddr,
                FRP_SERVER_PORT: config.frp.serverPort.toString(),
                FRP_NAME: 'API-' + address,
                FRP_LOCAL_IP: tunnel_name,
                FRP_LOCAL_PORT: tunnel_port.toString(),
                FRP_CUSTOM_DOMAIN: address + '.' + config.frp.serverAddr,
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

  async containerRunOperation (
      id: string,
      index: number,
    ): Promise<boolean> {
      const frpcImage = 'registry.hub.docker.com/nosana/frpc:0.1.0';
      const s3HelperImage =
        'registry.hub.docker.com/nosana/remote-resource-helper:0.4.0';

      const flow = this.repository.getflow(id)
      const opState = this.repository.getOpState(id, index)
      const op = flow.jobDefinition.ops[index] as Operation<'container/run'>
      
      try {
        this.repository.updateOpState(id, index, {
          startTime: Date.now(),
          status: 'running',
        })

        let container = await this.containerOrchestration.getContainer(
          opState.providerId as string,
        );

        const exist = (await this.containerOrchestration.doesContainerExist(opState.providerId as string)).result
        const exited = (await this.containerOrchestration.isContainerExited(opState.providerId as string)).result

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
          networks[name] = {};

          ({ status, error } = await this.containerOrchestration.createNetwork(
            name,
          ));
          if (!status) {
            throw error;
          }

          if (op.args.expose) {
            const exposedUrlSecret = randomUUID();
            this.repository.updateflowStateSecret(id, { exposedUrl: exposedUrlSecret });
            const prefix = op.args.private ? exposedUrlSecret : flow.id;

            ({ status, error } = await this.containerOrchestration.pullImage(
              frpcImage,
            ));
            if (!status) {
              throw error;
            }

            ({ status, error, result } =
              await this.containerOrchestration.runContainer(frpcImage, {
                name: 'frpc-' + name,
                cmd: ['-c', '/etc/frp/frpc.toml'],
                networks,
                env: {
                  FRP_SERVER_ADDR: config.frp.serverAddr,
                  FRP_SERVER_PORT: config.frp.serverPort.toString(),
                  FRP_NAME: name,
                  FRP_LOCAL_IP: name,
                  FRP_LOCAL_PORT: op.args.expose.toString(),
                  FRP_CUSTOM_DOMAIN: prefix + '.' + config.frp.serverAddr,
                  NOSANA_ID: flow.id,
                },
              }));
            if (!status) {
              throw error;
            }

            // we will stream out a url for the job
            // link will be logged out if public
            const link = `https://${prefix}.${config.frp.serverAddr}`;
          }

          if (op.args.resources) {
            ({ status, error } = await this.containerOrchestration.pullImage(
              s3HelperImage,
            ));
            if (!status) {
              throw error;
            }

            try {
              volumes.push(
                ...(await getResourceVolumes(this.resourceManager, op.args)),
              );
            } catch (error) {
              throw error;
            }
          }

          ({ status, error, result } =
            await this.containerOrchestration.runContainer(
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

          const logStream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
          });

          logStream.on('data', (data) => {
            this.repository.updateOpStateLogs(id, index, data.toString());
          });

          if (op.args.private) {
            // do stuffs partaining to private jobs
            // the result and jobdefination will be secretly sent
          }

          if (!container) {
            throw new Error('provider failed to start container');
          }

          await container.wait();

          const info = await container.inspect();
          const logs = demuxOutput(
            await container.logs({
              follow: false,
              stdout: true,
              stderr: true,
            }),
          );

          this.repository.updateOpState(id, index, {
            logs,
            results: extractResultsFromLogs(logs, op.results),
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
    };

  async containerRunStopOperation(
      id: string,
      index: number,
    ): Promise<boolean> {
      const flow = this.repository.getflow(id)
      const opState = this.repository.getOpState(id, index)
      
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

    async volumeCreateOperation(
      id: string,
      index: number,
    ): Promise<boolean> {
      const flow = this.repository.getflow(id)
      const op = flow.jobDefinition.ops[index] as Operation<'container/create-volume'>
      
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

    async volumeStopOperation(
      id: string,
      index: number,
    ): Promise<boolean> {
      const flow = this.repository.getflow(id)
      const opState = this.repository.getOpState(id, index)
      
      const name = flow.id + '-' + opState.operationId;
      let { status, result, error } =
        await this.containerOrchestration.deleteVolume(name);
      
        return true;
    };

  public runOperation(type: string, param: { id: string; index: number }): Promise<boolean> {
    if (type == 'container/run') {
      return this.containerRunOperation(param.id, param.index);
    }
    if (type == 'container/create-volume') {
      return this.volumeCreateOperation(param.id, param.index);
    }
    throw new Error('function not supported');
  }

  public stopOperation(type: string, param: { id: string; index: number }): Promise<boolean> {
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

async function getResourceVolumes(
  resourceManager: ResourceManager,
  args: OperationArgsMap['container/run'],
) {
  const volumes: { dest: string; name: string; readonly?: boolean }[] = [];

  for (const resource of args.resources as Resource[]) {
    await resourceManager.volumes.createRemoteVolume(resource);
    if ((await resourceManager.volumes.hasVolume(resource)) === false) {
      const error = new Error(
        `Missing required resource ${createResourceName(resource)}.`,
      );
      throw error;
    }

    volumes.push({
      dest: resource.target,
      name: await resourceManager.volumes.getVolume(resource)!,
      readonly: resource.allowWrite ? false : true,
    });
  }
  return volumes;
}

function demuxOutput(buffer: Buffer): Log[] {
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
}
