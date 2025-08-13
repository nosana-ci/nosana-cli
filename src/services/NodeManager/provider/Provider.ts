import { OperationArgsMap } from '@nosana/sdk';

import { ContainerOrchestrationInterface } from './containerOrchestration/interface.js';
import { Flow, Operation } from './types.js';
import { applyLoggingProxyToClass } from '../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../repository/NodeRepository.js';
import { promiseTimeoutWrapper } from '../../../generic/timeoutPromiseWrapper.js';
import { extractLogsAndResultsFromLogBuffer } from '../../../providers/utils/extractLogsAndResultsFromLogBuffer.js';
import { ResourceManager } from '../node/resource/resourceManager.js';
import Dockerode from 'dockerode';
import { jobEmitter } from '../node/job/jobHandler.js';
import { configs } from '../configs/configs.js';
import { s3HelperImage } from '../node/resource/definition/index.js';
import {
  generateProxies,
  generateUrlSecretObject,
} from '../../../generic/expose-util.js';
import { ExposedPortHealthCheck } from './ExposedPortHealthCheck.js';
import { ExposedPort, getExposePorts, isOpExposed } from '@nosana/sdk';
import EventEmitter from 'events';

const frpcImage = 'docker.io/nosana/frpc:multi-v0.0.9';

export class Provider {
  constructor(
    public containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
    private resourceManager: ResourceManager,
    private emitter?: EventEmitter,
  ) {
    applyLoggingProxyToClass(this);
  }

  private exposedPortHealthCheck: ExposedPortHealthCheck | undefined;
  private currentContainer: Dockerode.Container | undefined;

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

      this.resourceManager.images.setImage(frpcImage);

      ({ status, error } = await this.containerOrchestration.pullImage(
        tunnelImage,
      ));
      if (!status) {
        throw error;
      }

      this.resourceManager.images.setImage(tunnelImage);

      ({ status, error, result } =
        await this.containerOrchestration.doesContainerExist(tunnel_name));
      if (!status) {
        throw error;
      }

      if (!result) {
        ({ status, error, result } =
          await this.containerOrchestration.runFlowContainer(
            tunnelImage,
            {
              name: tunnel_name,
              networks,
              requires_network_mode: true,
              restart_policy: 'on-failure',
              env: {
                PORT: tunnel_port.toString(),
              },
            },
            false,
          ));
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
            await this.containerOrchestration.runFlowContainer(
              tunnelImage,
              {
                name: tunnel_name,
                networks,
                requires_network_mode: true,
                restart_policy: 'on-failure',
                env: {
                  PORT: tunnel_port.toString(),
                },
              },
              false,
            ));
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
          await this.containerOrchestration.runFlowContainer(
            frpcImage,
            {
              name: 'frpc-api-' + address,
              cmd: ['-c', '/etc/frp/frpc.toml'],
              networks,
              requires_network_mode: true,
              restart_policy: 'on-failure',
              env: {
                FRP_SERVER_ADDR: configs().frp.serverAddr,
                FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                FRP_PROXIES: JSON.stringify([
                  {
                    name: 'API-' + address,
                    localIp: tunnel_name,
                    localPort: tunnel_port.toString(),
                    customDomain: address + '.' + configs().frp.serverAddr,
                  },
                ]),
              },
              volumes: [
                {
                  name: `frpc-${address}-logs`,
                  dest: '/data',
                },
              ],
            },
            false,
          ));
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
            await this.containerOrchestration.runFlowContainer(
              frpcImage,
              {
                name: 'frpc-api-' + address,
                cmd: ['-c', '/etc/frp/frpc.toml'],
                networks,
                requires_network_mode: true,
                restart_policy: 'on-failure',
                env: {
                  FRP_SERVER_ADDR: configs().frp.serverAddr,
                  FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                  FRP_PROXIES: JSON.stringify([
                    {
                      name: 'API-' + address,
                      localIp: tunnel_name,
                      localPort: tunnel_port.toString(),
                      customDomain: address + '.' + configs().frp.serverAddr,
                    },
                  ]),
                },
                volumes: [
                  {
                    name: `frpc-${address}-logs`,
                    dest: '/data',
                  },
                ],
              },
              false,
            ));
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

  async containerRunOperation(id: string, index: number): Promise<boolean> {
    const flow = this.repository.getflow(id);
    const opState = this.repository.getOpState(id, index);
    const op = flow.jobDefinition.ops[index] as Operation<'container/run'>;

    let frpcContainer;

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
          op.args.authentication?.docker,
        );

        if (!status) {
          throw error;
        }

        if (!op.args.authentication?.docker) {
          this.resourceManager.images.setImage(op.args.image);
        }

        const name = flow.id + '-' + index;
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
        let idMaps: Map<string, ExposedPort> = new Map();
        const ports = getExposePorts(op);

        if (isOpExposed(op as Operation<'container/run'>)) {
          networks[name] = {};

          ({ status, error } = await this.containerOrchestration.createNetwork(
            name,
          ));
          if (!status) {
            throw error;
          }

          ({ status, error } = await this.containerOrchestration.pullImage(
            frpcImage,
          ));
          if (!status) {
            throw error;
          }

          this.resourceManager.images.setImage(frpcImage);

          /**
           * because of the introduction of deployment_id(load balancing key) instead of using flow.id we use deployment_id for more
           * deterministic url generation
           */
          const isLoadBalanced = !!flow.jobDefinition.deployment_id;
          const flowKey = flow.jobDefinition.deployment_id ?? flow.id;

          const { proxies, idMap } = generateProxies(
            flow.id,
            op,
            index,
            ports,
            name,
            opState.operationId,
            flow.jobDefinition.deployment_id, // TODO: This should be the hash
          );
          idMaps = idMap;

          ({ status, error, result } =
            await this.containerOrchestration.runFlowContainer(frpcImage, {
              name: 'frpc-' + name,
              cmd: ['/entrypoint.sh'],
              networks,
              requires_network_mode: true,
              env: {
                FRP_SERVER_ADDR: configs().frp.serverAddr,
                FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                NOSANA_ID: flow.id,
                FRP_PROXIES: JSON.stringify(proxies),
                ...(isLoadBalanced && {
                  FRP_LB_GROUP: flow.jobDefinition.deployment_id, // TODO: This should be the hash
                  // TODO: maybe add loadbalance.groupKey should be the project key?
                }),
              },
            }));

          if (!status) {
            throw error;
          }

          frpcContainer = result;

          if (op.args.private) {
            this.repository.updateflowStateSecret(id, {
              [id]: generateUrlSecretObject(idMap),
              urlmode: 'private',
            });
          } else {
            this.repository.updateflowStateSecret(id, {
              [id]: generateUrlSecretObject(idMap),
              urlmode: 'public',
            });
          }
        }

        if (op.args.resources) {
          ({ status, error } = await this.containerOrchestration.pullImage(
            s3HelperImage,
          ));
          if (!status) {
            throw error;
          }
          this.resourceManager.images.setImage(s3HelperImage);

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
              requires_network_mode: isOpExposed(
                op as Operation<'container/run'>,
              ),
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

        this.currentContainer = container;

        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
        });

        logStream.on('data', (data) => {
          this.repository.displayLog(data.toString());
        });

        if (isOpExposed(op)) {
          this.exposedPortHealthCheck = new ExposedPortHealthCheck(
            flow.id,
            frpcContainer as Dockerode.Container,
            this.emitter ?? jobEmitter,
            name,
          );
          this.exposedPortHealthCheck.addExposedPortsMap(idMaps);
          this.exposedPortHealthCheck.startServiceExposedUrlHealthCheck();
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
            tail: 24999,
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
            log: (error as Error).message,
          },
        ],
      });

      this.exposedPortHealthCheck?.stopAllHealthChecks();
      this.exposedPortHealthCheck = undefined;

      return false;
    }

    this.exposedPortHealthCheck?.stopAllHealthChecks();
    this.exposedPortHealthCheck = undefined;

    return true;
  }

  async finishCurrentRunningContainer() {
    const container = this.currentContainer;
    if (container) {
      await this.containerOrchestration.stopContainer(container.id);
    }
  }

  async containerRunStopOperation(id: string, index: number): Promise<boolean> {
    const flow = this.repository.getflow(id);
    const opState = this.repository.getOpState(id, index);

    const name = flow.id + '-' + index;

    const containers = await this.containerOrchestration.getContainersByName([
      name,
      'frpc-' + name,
    ]);

    for (let c of containers) {
      await this.containerOrchestration.stopAndDeleteContainer(c.id);
    }
    await this.containerOrchestration.deleteNetwork(name);

    if (
      (flow.jobDefinition.ops[index].args as OperationArgsMap['container/run'])
        .authentication?.docker
    ) {
      await this.containerOrchestration.deleteImage(
        (
          flow.jobDefinition.ops[index]
            .args as OperationArgsMap['container/run']
        ).image,
      );
    }

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
            log: (error as Error).message,
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
