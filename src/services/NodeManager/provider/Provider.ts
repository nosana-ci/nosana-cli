import { OperationArgsMap, OperationType, Ops } from '@nosana/sdk';

import { ContainerOrchestrationInterface } from './containerOrchestration/interface.js';
import { Flow, Operation } from './types.js';
import { applyLoggingProxyToClass } from '../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../repository/NodeRepository.js';
import { promiseTimeoutWrapper } from '../../../generic/timeoutPromiseWrapper.js';
import { ResourceManager } from '../node/resource/resourceManager.js';
import Dockerode from 'dockerode';
import { configs } from '../configs/configs.js';
import { s3HelperImage } from '../node/resource/definition/index.js';
import {
  generateProxies,
  generateUrlSecretObject,
} from '../../../generic/expose-util.js';
import { ExposedPortHealthCheck } from './ExposedPortHealthCheck.js';
import { ExposedPort, getExposePorts, isOpExposed } from '@nosana/sdk';
import EventEmitter from 'events';

const frpcImage = 'docker.io/nosana/frpc:multi-v0.0.4';
const tunnelImage = 'docker.io/nosana/tunnel:0.1.0';

export class Provider {
  constructor(
    public containerOrchestration: ContainerOrchestrationInterface,
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
      // Check if the tunnel container exists and stop/delete it
      const doesTunnelExist =
        await this.containerOrchestration.doesContainerExist(tunnel_name);
      if (doesTunnelExist) {
        await this.containerOrchestration.stopAndDeleteContainer(tunnel_name);
      }

      // Check if the frpc container exists and stop/delete it
      const doesFrpcExist =
        await this.containerOrchestration.doesContainerExist(frpc_name);
      if (doesFrpcExist) {
        await this.containerOrchestration.stopAndDeleteContainer(frpc_name);
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
    try {
      const networkName = `api-${address}`;
      const tunnel_port = 3000;
      const tunnel_name = `tunnel-api-${address}`;
      const frpc_name = `frpc-api-${address}`;

      await this.containerOrchestration.createNetwork(networkName);

      const networks: { [key: string]: {} } = {};
      networks[networkName] = {};

      await this.containerOrchestration.pullImage(frpcImage);

      this.resourceManager.images.setImage(frpcImage);

      await this.containerOrchestration.pullImage(tunnelImage);

      this.resourceManager.images.setImage(tunnelImage);

      const doesTunnelExist =
        await this.containerOrchestration.doesContainerExist(tunnel_name);

      if (!doesTunnelExist) {
        await this.containerOrchestration.runFlowContainer(tunnelImage, {
          name: tunnel_name,
          networks,
          requires_network_mode: true,
          restart_policy: 'on-failure',
          env: {
            PORT: tunnel_port.toString(),
          },
        });
      } else {
        const hasTunnelExited =
          await this.containerOrchestration.isContainerExited(tunnel_name);

        if (hasTunnelExited) {
          await this.containerOrchestration.stopAndDeleteContainer(tunnel_name);
          await this.containerOrchestration.runFlowContainer(tunnelImage, {
            name: tunnel_name,
            networks,
            requires_network_mode: true,
            restart_policy: 'on-failure',
            env: {
              PORT: tunnel_port.toString(),
            },
          });
        }
      }

      const doesFrpcExist =
        await this.containerOrchestration.doesContainerExist(frpc_name);

      if (!doesFrpcExist) {
        await this.containerOrchestration.runFlowContainer(frpcImage, {
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
        });
      } else {
        const hasFrpcExited =
          await this.containerOrchestration.isContainerExited(frpc_name);

        if (hasFrpcExited) {
          await this.containerOrchestration.stopAndDeleteContainer(frpc_name);

          await this.containerOrchestration.runFlowContainer(frpcImage, {
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
          });
        }
      }
    } catch (error) {
      throw error;
    }
    return true;
  }

  async taskManagerContainerRunOperation(
    flow: Flow,
    op: Operation<'container/run'>,
    controller: AbortController,
    emitter: EventEmitter,
  ) {
    let logStream: NodeJS.ReadableStream | undefined;
    let exposedPortHealthCheck: ExposedPortHealthCheck | undefined;

    if (controller.signal.aborted) {
      emitter.emit('exit', { exitCode: 0 });
      emitter.emit('end');
      return;
    }

    try {
      emitter.emit('start');
      let frpcContainer;
      let container = await this.containerOrchestration.getContainer(op.id);

      const exist = await this.containerOrchestration.doesContainerExist(op.id);
      const exited = await this.containerOrchestration.isContainerExited(op.id);

      if (exist && !exited && container.id) {
        logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
          abortSignal: controller.signal,
        });

        logStream.on('data', (data) => {
          emitter.emit('log', data.toString(), 'container');
        });
      } else {
        await this.containerOrchestration.pullImage(
          op.args.image,
          op.args.authentication?.docker,
          controller,
        );

        if (!op.args.authentication?.docker) {
          this.resourceManager.images.setImage(op.args.image);
        }

        const index = getOpStateIndex(flow.jobDefinition.ops, op.id);
        const name = flow.id + '-' + op.id;
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

          await this.containerOrchestration.createNetwork(name, controller);
          await this.containerOrchestration.pullImage(
            frpcImage,
            undefined,
            controller,
          );

          this.resourceManager.images.setImage(frpcImage);

          const { proxies, idMap } = generateProxies(
            flow.id,
            op,
            index,
            ports,
            name,
            op.id,
          );
          idMaps = idMap;

          frpcContainer = await this.containerOrchestration.runFlowContainer(
            frpcImage,
            {
              name: 'frpc-' + name,
              cmd: ['/entrypoint.sh'],
              networks,
              requires_network_mode: true,
              env: {
                FRP_SERVER_ADDR: configs().frp.serverAddr,
                FRP_SERVER_PORT: configs().frp.serverPort.toString(),
                NOSANA_ID: flow.id,
                FRP_PROXIES: JSON.stringify(proxies),
              },
            },
          );

          if (op.args.private) {
            this.repository.updateflowStateSecret(flow.id, {
              [flow.id]: generateUrlSecretObject(idMap),
              urlmode: 'private',
            });
          } else {
            const newSecret = generateUrlSecretObject(idMap);

            const currentSecrets =
              this.repository.getFlowSecret(flow.id, flow.id) || {};
            const mergedSecrets = {
              ...currentSecrets,
              ...newSecret,
            };

            this.repository.updateflowStateSecret(flow.id, {
              [flow.id]: mergedSecrets,
              urlmode: 'public',
            });
          }
        }

        if (op.args.resources) {
          await this.containerOrchestration.pullImage(
            s3HelperImage,
            undefined,
            controller,
          );
          this.resourceManager.images.setImage(s3HelperImage);

          const resourceVolumes = await this.resourceManager.getResourceVolumes(
            op.args.resources ?? [],
            controller,
          );

          try {
            volumes.push(...resourceVolumes);
          } catch (error) {
            throw error;
          }
        }

        container = await this.containerOrchestration.runFlowContainer(
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
        );

        emitter.emit('updateOpState', { providerId: container.id });

        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
          abortSignal: controller.signal,
        });

        logStream.on('data', (data) => {
          emitter.emit('log', data.toString(), 'container');
        });

        if (isOpExposed(op)) {
          exposedPortHealthCheck = new ExposedPortHealthCheck(
            flow.id,
            frpcContainer as Dockerode.Container,
            emitter,
            name,
          );

          exposedPortHealthCheck.addExposedPortsMap(idMaps);
          exposedPortHealthCheck.startServiceExposedUrlHealthCheck();
        } else {
          emitter.emit('healthcheck:startup:success');
        }

        await container.wait({ abortSignal: controller.signal });
      }

      const info = await promiseTimeoutWrapper(
        container.inspect({
          abortSignal: controller.signal,
        }),
        360,
        controller,
      );

      emitter.emit('exit', { exitCode: info.State.ExitCode });
    } catch (error) {
      emitter.emit('log', error, 'error');
      emitter.emit('error', error);
    }

    exposedPortHealthCheck?.stopAllHealthChecks();
    exposedPortHealthCheck = undefined;

    logStream?.removeAllListeners();

    emitter.emit('end');
  }

  async taskManagerContainerStopRunOperation(
    flow: Flow,
    op: Operation<'container/run'>,
    emitter?: EventEmitter,
  ): Promise<void> {
    try {
      const name = flow.id + '-' + op.id;
      const index = getOpStateIndex(flow.jobDefinition.ops, op.id);

      const containers = await this.containerOrchestration.getContainersByName([
        name,
        'frpc-' + name,
      ]);

      for (let c of containers) {
        await this.containerOrchestration.stopAndDeleteContainer(c.id);
      }
      await this.containerOrchestration.deleteNetwork(name);

      if (
        (
          flow.jobDefinition.ops[index]
            .args as OperationArgsMap['container/run']
        ).authentication?.docker
      ) {
        await this.containerOrchestration.deleteImage(
          (
            flow.jobDefinition.ops[index]
              .args as OperationArgsMap['container/run']
          ).image,
        );
      }
    } catch (error) {
      emitter?.emit('log', error, 'error');
      throw error;
    }
  }

  /**
   * Runs a full container operation lifecycle:
   * 1. Starts the container, emits lifecycle events, waits for completion or error.
   * 2. Then stops and cleans up the container, network, and associated Docker resources.
   *
   * This function ties together both the **execution** and **cleanup** stages for a containerized operation.
   *
   * The steps are:
   * - Emits 'start' → Pulls container image (if needed) → Creates volume/network (if needed)
   * - Runs container with correct args/env/entrypoint
   * - Follows logs and emits 'log' → Waits for completion → Emits 'exit' or 'error'
   * - Regardless of outcome, cleans up resources (containers, networks, optional image)
   *
   * Emits:
   * - 'start': when the operation begins
   * - 'log': every time stdout/stderr produces output
   * - 'updateOpState': to attach container ID
   * - 'exit': when the operation finishes successfully or with failure
   * - 'error': when something crashes
   * - 'end': always, after cleanup
   *
   * @param flow - The job flow this operation is part of
   * @param op - The specific container operation to run
   * @param controller - AbortController to support cancellation
   * @param emitter - EventEmitter to stream logs and events from the container lifecycle
   */
  async taskManagerContainerStartRunandStopOperation(
    flow: Flow,
    op: Operation<'container/run'>,
    controller: AbortController,
    emitter: EventEmitter,
  ) {
    try {
      await this.taskManagerContainerRunOperation(
        flow,
        op,
        controller,
        emitter,
      );
    } finally {
      await this.taskManagerContainerStopRunOperation(flow, op, emitter);
    }
  }

  async taskManagerVolumeStartRunandStopOperation(
    flow: Flow,
    op: Operation<'container/create-volume'>,
    controller: AbortController,
    emitter: EventEmitter,
  ) {
    await this.taskManagerVolumeCreateOperation(flow, op, controller, emitter);
    /**
     * we don't put the volume stop here because it will delete the volume that
     * might be used by other operations in the group, we will leave that for the
     * final clean up.
     * await this.taskManagerVolumeStopOperation(flow, op, emitter)
     */
  }

  async taskManagerVolumeCreateOperation(
    flow: Flow,
    op: Operation<'container/create-volume'>,
    controller: AbortController,
    emitter: EventEmitter,
  ) {
    if (controller.signal.aborted) {
      emitter.emit('exit', { exitCode: 0 });
      emitter.emit('end');
      return;
    }

    try {
      emitter.emit('start');

      const name = flow.id + '-' + op.args.name;

      const isVolume = await this.containerOrchestration.hasVolume(name);
      if (!isVolume) {
        const volume = await this.containerOrchestration.createVolume(
          name,
          controller,
        );
        emitter.emit('updateOpState', { providerId: volume.Status });
      }

      emitter.emit('healthcheck:startup:success');

      emitter.emit('exit', { exitCode: 0 });
    } catch (error) {
      emitter.emit('log', error, 'error');
      emitter.emit('error', error);
    }
    emitter.emit('end');
  }

  async taskManagerVolumeStopOperation(
    flow: Flow,
    op: Operation<'container/create-volume'>,
    emitter?: EventEmitter,
  ) {
    try {
      const name = flow.id + '-' + op.args.name;

      const isVolume = await this.containerOrchestration.hasVolume(name);
      if (!isVolume) {
        await this.containerOrchestration.deleteVolume(name);
      }
    } catch (error) {
      emitter?.emit('log', error, 'error');
      throw error;
    }
  }

  public runTaskManagerOperation(
    flow: Flow,
    op: Operation<OperationType>,
    controller: AbortController,
    emitter: EventEmitter,
  ): Promise<void> {
    switch (op.type) {
      case 'container/run':
        return this.taskManagerContainerStartRunandStopOperation(
          flow,
          op as Operation<'container/run'>,
          controller,
          emitter,
        );

      case 'container/create-volume':
        return this.taskManagerVolumeStartRunandStopOperation(
          flow,
          op as Operation<'container/create-volume'>,
          controller,
          emitter,
        );

      default:
        throw new Error(`operation type '${op.type}' not supported`);
    }
  }

  public stopTaskManagerOperation(
    flow: Flow,
    op: Operation<OperationType>,
    emitter?: EventEmitter,
  ): Promise<void> {
    switch (op.type) {
      case 'container/run':
        return this.taskManagerContainerStopRunOperation(
          flow,
          op as Operation<'container/run'>,
          emitter,
        );

      case 'container/create-volume':
        return this.taskManagerVolumeStopOperation(
          flow,
          op as Operation<'container/create-volume'>,
          emitter,
        );

      default:
        throw new Error(`operation type '${op.type}' not supported`);
    }
  }
}

function getOpStateIndex(ops: Ops, opId: string): number {
  const index = ops.findIndex((op) => op.id === opId);

  if (index === -1) {
    throw new Error(`Operation not found for ID: ${opId}`);
  }

  return index;
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
