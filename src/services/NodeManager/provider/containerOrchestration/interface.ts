import {
  Container,
  ImageInfo,
  Image,
  Volume,
  VolumeCreateResponse,
  VolumeInspectInfo,
} from 'dockerode';
import { ReturnedStatus } from '../types.js';
import { DockerContainerOrchestration } from './DockerContainerOrchestration.js';
import { PodmanContainerOrchestration } from './PodmanContainerOrchestration.js';

export interface ContainerOrchestrationInterface {
  getConnection(): any;

  pullImage(image: string): Promise<ReturnedStatus>;
  hasImage(image: string): Promise<boolean>;
  getImage(image: string): Promise<Image>;
  listImages(): Promise<ImageInfo[]>;
  deleteImage(image: string): Promise<ReturnedStatus>;

  createNetwork(name: string): Promise<ReturnedStatus>;
  deleteNetwork(name: string): Promise<ReturnedStatus>;

  createVolume(name?: string): Promise<ReturnedStatus<VolumeCreateResponse>>;
  getVolume(name: string): Promise<ReturnedStatus<Volume>>;
  hasVolume(name: string): Promise<boolean>;
  getRawVolume(name: string): Promise<Volume>;
  listVolumes(): Promise<VolumeInspectInfo[]>;
  deleteVolume(name: string): Promise<ReturnedStatus>;

  getContainersByName(names: string[]): Promise<Container[]>;

  getContainer(id: string): Promise<Container>;
  runContainer(args: RunContainerArgs): Promise<ReturnedStatus<Container>>;
  runFlowContainer(
    image: string,
    args: RunContainerArgs,
  ): Promise<ReturnedStatus<Container>>;
  stopContainer(id: string): Promise<ReturnedStatus>;
  deleteContainer(id: string): Promise<ReturnedStatus>;
  stopAndDeleteContainer(id: string): Promise<ReturnedStatus>;
  isContainerExited(id: string): Promise<ReturnedStatus<boolean>>;
  doesContainerExist(id: string): Promise<ReturnedStatus<boolean>>;

  healthy(): Promise<ReturnedStatus>;
  check(): Promise<string>;

  healthy(): Promise<ReturnedStatus>;
  check(): Promise<string>;
}

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

export function selectContainerOrchestrationProvider(
  provider: string,
  url: string,
): ContainerOrchestrationInterface {
  switch (provider) {
    case 'podman':
      return new PodmanContainerOrchestration(url);
    case 'docker':
    default:
      return new DockerContainerOrchestration(url);
  }
}
