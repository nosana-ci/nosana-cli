import { type RunContainerArgs } from '../DockerProvider.js';
import { ifStringCastToArray } from '../../generic/utils.js';

const GPU_DEVICE = [
  {
    path: 'nvidia.com/gpu=all',
  },
];

/**
 * Takes image and args and return podman run options
 * @param image
 * @param args
 * @returns
 */
export function createPodmanRunOptions(image: string, args: RunContainerArgs) {
  const { name, networks, cmd, gpu, volumes, env, work_dir, entrypoint } = args;

  const devices = gpu ? GPU_DEVICE : [];
  return {
    image,
    name,
    command: cmd,
    volumes: volumes?.map((v) => {
      return {
        dest: v.dest,
        name: v.name,
        Options: v.readonly ? ['ro'] : [],
      };
    }),
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
  };
}