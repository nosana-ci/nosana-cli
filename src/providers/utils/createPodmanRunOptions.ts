import { DockerProvider, type RunContainerArgs } from '../DockerProvider.js';
import { ifStringCastToArray } from '../../generic/utils.js';
import { ResourceManager } from '../modules/resourceManager/index.js';

const GPU_DEVICE = [
  {
    path: 'nvidia.com/gpu=all',
  },
];

type Mount = {
  Destination: string;
  Source: string;
  Type: 'volume';
};

/**
 * Takes image and args and return podman run options
 * @param image
 * @param args
 * @returns
 */
export function createPodmanRunOptions(
  image: string,
  args: RunContainerArgs,
  resourceManager: ResourceManager,
) {
  const { name, networks, cmd, gpu, volumes, env, work_dir, entrypoint } = args;

  const devices = gpu ? GPU_DEVICE : [];

  const mounts: Mount[] = [];

  if (args.remoteResources && args.remoteResources.length > 0) {
    args.remoteResources.forEach((resource) => {
      const source = resourceManager.volumeManager.getVolume(resource.bucket);

      if (source) {
        mounts.push({
          Destination: resource.target,
          Source: source,
          Type: 'volume',
        });
      } else {
        throw new Error(`Remote resource volume not found: ${resource.bucket}`);
      }
    });
  }

  return {
    image,
    name,
    command: cmd,
    volumes,
    ...(entrypoint
      ? { entrypoint: ifStringCastToArray(entrypoint) }
      : undefined),
    env,
    devices,
    netns: { nsmode: 'bridge' },
    Networks: networks,
    create_working_dir: true,
    cgroups_mode: 'disabled',
    work_dir,
    ...(mounts.length > 0 ? { mounts } : undefined),
  };
}
