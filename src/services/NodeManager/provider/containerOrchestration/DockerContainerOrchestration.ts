import os from 'os';
import Dockerode, {
  Container,
  ContainerCreateOptions,
  ImageInfo,
  Image,
  MountSettings,
  Volume,
  VolumeCreateResponse,
  VolumeInspectInfo,
} from 'dockerode';
import { DockerAuth } from '@nosana/sdk';

import { DockerExtended } from '../../../../docker/index.js';
import { createSeverObject } from '../../../../providers/utils/createServerObject.js';
import { abortControllerSelector } from '../../node/abort/abortControllerSelector.js';
import {
  ContainerOrchestrationInterface,
  RunContainerArgs,
} from './interface.js';

import { ReturnedStatus } from '../types.js';
import { checkDeprecationDeadline } from '../../../../providers/utils/deadline.js';

export class DockerContainerOrchestration
  implements ContainerOrchestrationInterface
{
  public docker: DockerExtended;
  public host: string;
  public port: string;
  public protocol: 'https' | 'http' | 'ssh' | 'socket';
  public name: string = 'docker';
  public gpu: string = 'all';

  public listeners = new Map<string, Array<() => Promise<void>>>();

  constructor(server: string, gpu: string) {
    this.gpu = gpu;
    if (server.startsWith('http') || server.startsWith('ssh')) {
      const { host, port, protocol } = createSeverObject(server);

      this.host = host;
      this.port = port;
      this.protocol = protocol;
      this.docker = new DockerExtended({
        host: this.host,
        port: this.port,
        protocol: this.protocol,
      });
    } else {
      // Assume server is a socket path
      this.protocol = 'socket';
      if (server.startsWith('~')) {
        server = server.replace('~', os.homedir());
      }
      this.host = server;
      this.port = '';
      this.docker = new DockerExtended({ socketPath: this.host });
    }
  }

  async getContainersByName(names: string[]): Promise<Container[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });

      const matchedContainers = containers.filter((container) =>
        names.some((name) => container.Names.includes(`/${name}`)),
      );

      if (matchedContainers.length > 0) {
        const containerObjects = matchedContainers.map((containerInfo) =>
          this.docker.getContainer(containerInfo.Id),
        );

        return containerObjects;
      } else {
        return [];
      }
    } catch (_) {
      throw new Error('could not get containers');
    }
  }

  getConnection() {
    return this.docker;
  }

  async pullImage(
    image: string,
    authorisation?: DockerAuth,
  ): Promise<ReturnedStatus> {
    if (await this.docker.hasImage(image)) {
      return { status: true };
    }

    const controller = abortControllerSelector() as AbortController;

    if (controller.signal.aborted) {
      return { status: false, error: controller.signal.reason };
    }

    try {
      await this.docker.promisePull(image, controller, authorisation);
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async hasImage(image: string): Promise<boolean> {
    if (await this.docker.hasImage(image)) {
      return true;
    }
    return false;
  }

  async getImage(image: string): Promise<Image> {
    return this.docker.getImage(image);
  }

  async listImages(): Promise<ImageInfo[]> {
    return this.docker.listImages();
  }

  async deleteImage(image: string): Promise<ReturnedStatus> {
    try {
      if (await this.docker.hasImage(image)) {
        await this.docker.getImage(image).remove({ force: true });
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async createNetwork(name: string): Promise<ReturnedStatus> {
    try {
      if (await this.hasNetwork('NOSANA_GATEWAY')) {
        return { status: true };
      }
    } catch {}

    try {
      await this.docker.createNetwork({
        Name: 'NOSANA_GATEWAY',
        IPAM: {
          Driver: 'bridge',
          Config: [
            {
              Subnet: '192.168.101.0/24',
              Gateway: '192.168.101.1',
            },
          ],
        },
      });
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async hasNetwork(name: string): Promise<boolean> {
    const networks = await this.docker.listNetworks();
    return networks.some((network) => network.Name === name);
  }

  async deleteNetwork(name: string): Promise<ReturnedStatus> {
    try {
      // await this.docker.getNetwork(name).remove();
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async createVolume(
    name?: string,
  ): Promise<ReturnedStatus<VolumeCreateResponse>> {
    try {
      const volume = await this.docker.createVolume({ Name: name });
      return { status: true, result: volume };
    } catch (error) {
      return { status: false, error };
    }
  }

  async hasVolume(name: string): Promise<boolean> {
    try {
      const volumes = await this.docker.listVolumes();
      return volumes.Volumes.some((volume) => volume.Name === name);
    } catch (error) {
      return false;
    }
  }

  async listVolumes(): Promise<VolumeInspectInfo[]> {
    return (await this.docker.listVolumes()).Volumes;
  }

  async getVolume(name: string): Promise<ReturnedStatus<Volume>> {
    try {
      const volume = this.docker.getVolume(name);
      return { status: true, result: volume };
    } catch (error) {
      return { status: false, error };
    }
  }

  async getRawVolume(name: string): Promise<Volume> {
    return this.docker.getVolume(name);
  }

  async deleteVolume(name: string): Promise<ReturnedStatus> {
    try {
      const volume = this.docker.getVolume(name);
      if (volume) {
        await this.docker.getVolume(name).remove({ force: true });
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async healthy(): Promise<ReturnedStatus> {
    if (this.protocol != 'socket') {
      checkDeprecationDeadline();
    }

    try {
      const info = await this.docker.info();
      if (typeof info === 'object' && info !== null && info.ID) {
        return { status: true };
      }
      return { status: false, error: new Error('invalid docker info') };
    } catch (error) {
      return { status: false, error };
    }
  }

  async getContainer(id: string): Promise<Container> {
    const container = this.docker.getContainer(id);
    return container;
  }

  getProtocol(): string {
    return this.protocol;
  }

  setupContainerAbortListener(containerId: string) {
    const controller = abortControllerSelector() as AbortController;

    if (controller.signal.aborted) {
      this.stopContainer(containerId);
    }

    const stopFunction = async () => {
      await this.stopContainer(containerId);
    };

    controller.signal.addEventListener('abort', stopFunction);
    const current = this.listeners.get(containerId) || [];
    current.push(stopFunction);
    this.listeners.set(containerId, current);
  }

  async runContainer(
    args: ContainerCreateOptions,
    addAbortListener = true,
  ): Promise<ReturnedStatus<Container>> {
    const controller = abortControllerSelector() as AbortController;
    if (controller.signal.aborted) {
      return { status: false, error: controller.signal.reason };
    }

    try {
      const container = await this.docker.createContainer(args);
      await container.start();
      if (addAbortListener) {
        this.setupContainerAbortListener(container.id);
      }
      return { status: true, result: container };
    } catch (error) {
      return { status: false, error };
    }
  }

  async runFlowContainer(
    image: string,
    args: RunContainerArgs,
    addAbortListener = true,
  ): Promise<ReturnedStatus<Container>> {
    const controller = abortControllerSelector() as AbortController;
    if (controller.signal.aborted) {
      return { status: false, error: controller.signal.reason };
    }

    try {
      const container = await this.docker.createContainer(
        mapRunContainerArgsToContainerCreateOpts(image, args, this.gpu),
      );

      await container.start();

      if (addAbortListener) {
        this.setupContainerAbortListener(container.id);
      }

      return { status: true, result: container };
    } catch (error) {
      return { status: false, error };
    }
  }

  async stopContainer(containerId: string): Promise<ReturnedStatus> {
    const listeners = this.listeners.get(containerId) || [];

    for (const listener of listeners) {
      abortControllerSelector().signal.removeEventListener('abort', listener);
    }

    try {
      const container = this.docker.getContainer(containerId);
      if (container.id) {
        let containerInfo: Dockerode.ContainerInspectInfo | undefined;

        try {
          containerInfo = await container.inspect();
        } catch (error) {}

        if (containerInfo) {
          if (containerInfo.State.Status !== 'exited') {
            this.docker.getContainer(containerId).stop();
          }
        }
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async stopAndDeleteContainer(containerId: string): Promise<ReturnedStatus> {
    const listeners = this.listeners.get(containerId) || [];

    for (const listener of listeners) {
      abortControllerSelector().signal.removeEventListener('abort', listener);
    }

    try {
      const container = this.docker.getContainer(containerId);

      if (container.id) {
        let info: Dockerode.ContainerInspectInfo | undefined;

        try {
          info = await container.inspect();
        } catch (error) {}

        if (info) {
          try {
            await container.stop();
          } catch (error) {}

          try {
            await container.remove({ force: true, v: true });
          } catch (error) {}
        }
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async isContainerExited(
    containerId: string,
  ): Promise<ReturnedStatus<boolean>> {
    try {
      const container = this.docker.getContainer(containerId);

      let containerInfo: Dockerode.ContainerInspectInfo | undefined;

      try {
        containerInfo = await container.inspect();
      } catch (error) {}

      if (containerInfo) {
        return { status: true, result: containerInfo.State.Status == 'exited' };
      } else {
        return { status: true, result: true };
      }
    } catch (error) {
      return { status: false, error };
    }
  }

  async doesContainerExist(
    containerId: string,
  ): Promise<ReturnedStatus<boolean>> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect();
      return { status: true, result: true };
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return { status: true, result: false };
      } else {
        return { status: false, error };
      }
    }
  }

  async check(): Promise<string> {
    const { status, error } = await this.healthy();
    if (!status) {
      throw new Error(
        `error on container orchestration (docker or podman), error: ${error}`,
      );
    }
    return `${this.protocol}://${this.host}:${this.port}`;
  }
}

function mapRunContainerArgsToContainerCreateOpts(
  image: string,
  {
    name,
    networks,
    cmd,
    gpu,
    volumes,
    env,
    work_dir,
    requires_network_mode,
    entrypoint,
  }: RunContainerArgs,
  gpuOption: string,
): ContainerCreateOptions {
  const devices = gpu
    ? [
        {
          ...(gpuOption === 'all'
            ? { Count: -1 }
            : { device_ids: gpuOption.split(',') }),
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
  return {
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
      EndpointsConfig: {
        ...(requires_network_mode ? { NOSANA_GATEWAY: {} } : undefined),
      },
    },
    HostConfig: {
      ExtraHosts: [
        'host.docker.internal:8.8.8.8',
        'host.containers.internal:8.8.8.8',
      ],
      Mounts: dockerVolumes,
      NetworkMode: 'bridge',
      DeviceRequests: devices,
    },
  };
}
