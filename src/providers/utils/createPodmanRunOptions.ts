import { RestartPolicy } from '@nosana/sdk';

import { ifStringCastToArray } from '../../generic/utils.js';
import { RunContainerArgs } from '../../services/NodeManager/provider/containerOrchestration/interface.js';

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

  // Base device for network tunneling
  const tunDevice = {
    path: '/dev/net/tun',
    type: 'c' as const,
    major: 10,
    minor: 200,
    fileMode: 438,
    uid: 0,
    gid: 0,
  };

  // Build devices array starting with the TUN device
  const devices = [tunDevice];

  // Add GPU devices if requested
  if (gpu) {
    if (gpuOption === 'all') {
      devices.push({ path: 'nvidia.com/gpu=all' });
    } else {
      devices.push(
        ...gpuOption.split(',').map((id) => ({ path: `nvidia.com/gpu=${id}` })),
      );
    }
  }

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
    cap_add: ['NET_ADMIN'],
    work_dir,
  };
}
