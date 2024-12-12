import { type RunContainerArgs } from '../DockerProvider.js';
import { ifStringCastToArray } from '../../generic/utils.js';

/**
 * Takes image and args and return podman run options
 * @param image
 * @param args
 * @param gpu
 * @returns
 */
export function createPodmanRunOptions(
  image: string,
  args: RunContainerArgs,
  gpuOption: string,
) {
  const {
    name,
    networks,
    cmd,
    gpu,
    volumes,
    env,
    work_dir,
    entrypoint,
    network_mode,
    restart_policy,
  } = args;

  const devices = gpu
    ? gpuOption === 'all'
      ? [
          {
            path: 'nvidia.com/gpu=all',
          },
        ]
      : gpuOption.split(',').map((id) => ({ path: `nvidia.com/gpu=${id}` }))
    : [];

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
    restart_policy,
    netns: { nsmode: network_mode || 'bridge' },
    Networks: networks,
    create_working_dir: true,
    cgroups_mode: 'disabled',
    work_dir,
  };
}
