import { ifStringCastToArray } from '../../generic/utils.js';
import { RunContainerArgs } from '../../services/NodeManager/provider/containerOrchestration/interface.js';

// Todo use sdk types when they are available
export type RestartPolicy =
  | 'always'
  | 'unless-stopped'
  | 'on-failure'
  | {
      policy: 'on-failure';
      restart_tries?: number;
    };
// These extra types are required because interface.ts
function parseRestartPolicy(restart_policy: RestartPolicy | '' | undefined) {
  if (typeof restart_policy === 'string') {
    return {
      restart_policy:
        restart_policy === 'always' ? 'unless-stopped' : restart_policy,
    };
  }
  if (typeof restart_policy === 'object' && 'policy' in restart_policy) {
    return {
      restart_policy: restart_policy.policy,
      ...(restart_policy.restart_tries
        ? { restart_tries: restart_policy.restart_tries }
        : {}),
    };
  }
  return {};
}

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
    cmd,
    gpu,
    volumes,
    env,
    aliases,
    work_dir,
    entrypoint,
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
    ...parseRestartPolicy(restart_policy),
    hostadd: [
      'host.docker.internal:8.8.8.8',
      'host.containers.internal:8.8.8.8',
    ],
    netns: { nsmode: 'bridge' },
    Networks: {
      NOSANA_GATEWAY: aliases ? { aliases } : {},
    },
    create_working_dir: true,
    cgroups_mode: 'disabled',
    work_dir,
  };
}
