import {
  Container,
  ContainerCreateOptions,
  ImageInfo,
  Image,
  MountSettings,
  Volume,
  VolumeCreateResponse,
  VolumeInspectInfo,
} from 'dockerode';
import { DockerExtended } from '../../../../docker/index.js';
import { createSeverObject } from '../../../../providers/utils/createServerObject.js';
import {
  ContainerOrchestrationInterface,
  RunContainerArgs,
} from './interface.js';
import { ReturnedStatus } from '../types.js';

export class DockerContainerOrchestration
  implements ContainerOrchestrationInterface
{
  public docker: DockerExtended;
  public host: string;
  public port: string;
  public protocol: 'https' | 'http' | 'ssh';
  public name: string = 'docker';

  constructor(server: string) {
    const { host, port, protocol } = createSeverObject(server);

    this.host = host;
    this.port = port;
    this.protocol = protocol;

    this.docker = new DockerExtended({
      host: this.host,
      port: this.port,
      protocol: this.protocol,
    });
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

  async pullImage(image: string): Promise<ReturnedStatus> {
    if (await this.docker.hasImage(image)) {
      return { status: true };
    }

    try {
      await this.docker.promisePull(image);
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async hasImage(image: string): Promise<boolean> {
    if (await this.docker.hasImage(image)) {
      return true
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
      await this.docker.createNetwork({ Name: name });
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async deleteNetwork(name: string): Promise<ReturnedStatus> {
    try {
      this.docker.getNetwork(name).remove();
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
      return volumes.Volumes.some(volume => volume.Name === name);
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

  async runContainer(
    args: RunContainerArgs,
  ): Promise<ReturnedStatus<Container>> {
    try {
      const container = await this.docker.createContainer(args);
      await container.start();
      return { status: true, result: container };
    } catch (error) {
      return { status: false, error };
    }
  }

  async runFlowContainer(
    image: string,
    args: RunContainerArgs,
  ): Promise<ReturnedStatus<Container>> {
    try {
      const container = await this.docker.createContainer(
        mapRunContainerArgsToContainerCreateOpts(image, args),
      );
      await container.start();
      return { status: true, result: container };
    } catch (error) {
      return { status: false, error };
    }
  }

  async stopContainer(id: string): Promise<ReturnedStatus> {
    try {
      const container = this.docker.getContainer(id);
      if (container.id) {
        const containerInfo = await container.inspect();
        if (containerInfo.State.Status !== 'exited') {
          this.docker.getContainer(id).stop();
        }
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async deleteContainer(id: string): Promise<ReturnedStatus> {
    try {
      if (this.docker.getContainer(id)) {
        this.docker.getContainer(id).remove({ force: true });
      }
      return { status: true };
    } catch (error) {
      return { status: false, error };
    }
  }

  async stopAndDeleteContainer(containerId: string): Promise<ReturnedStatus> {
    try {
      const container = this.docker.getContainer(containerId);
      if (container.id) {
        const containerInfo = await container.inspect();
        if (containerInfo.State.Status !== 'exited') {
          await container.stop();
        }
        await container.remove({ force: true });
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
      const info = await container.inspect();
      return { status: true, result: info.State.Status == 'exited' };
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
    network_mode,
    entrypoint,
  }: RunContainerArgs,
): ContainerCreateOptions {
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
      EndpointsConfig: networks,
    },
    HostConfig: {
      Mounts: dockerVolumes,
      NetworkMode: network_mode || 'bridge',
      DeviceRequests: devices,
    },
  };
}
