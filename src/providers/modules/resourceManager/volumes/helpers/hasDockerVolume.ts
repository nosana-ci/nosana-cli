import { VolumeInspectInfo } from 'dockerode';

export function hasDockerVolume(
  volume: string,
  volumes: VolumeInspectInfo[],
): boolean {
  return volumes.findIndex((vol) => vol.Name === volume) !== -1;
}
