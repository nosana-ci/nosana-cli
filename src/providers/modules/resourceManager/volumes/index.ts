import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';
import ora from 'ora';

import { NodeDb } from '../../../BasicProvider.js';
import { DockerExtended } from '../../../../docker/index.js';
import { hasDockerVolume } from './helpers/hasDockerVolume.js';
import { hoursSinceDate } from '../utils/hoursSinceDate.js';
import { RequiredResource } from '../../../../types/resources.js';

/**
 * Creates Volume Manager Sub-module
 * @param db
 * @param docker
 * @returns
 */
export function createVolumeManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
) {
  let market_required_volumes: RequiredResource[];

  /**
   * Fetch market required volumes
   * @param market
   */
  const pullMarketRequiredVolumes = async (
    remoteResources: RequiredResource[],
  ) => {
    market_required_volumes = remoteResources;

    const savedVolumes = db.data.resources.volumes;

    for (const resource of market_required_volumes) {
      if (!savedVolumes[resource.url]) {
        const spinner = ora(
          chalk.cyan(`Fetching remote resource ${chalk.bold(resource.url)}`),
        ).start();

        try {
          const volumeName = await docker.createRemoteVolume(resource);
          setVolume(resource.url, volumeName);
        } catch (err) {
          throw new Error(
            chalk.red(`Cannot pull remote resource ${resource.url}:\n`) + err,
          );
        }

        spinner.succeed();
      }
    }
  };

  /**
   * Will refetch updated market resources
   * Removes pruned volumes from db
   * Remove old none required volumes from db and docker
   * @return Promise
   */
  const resyncResourcesDB = async (): Promise<void> => {
    const savedVolumes = (await docker.listVolumes()).Volumes;

    for (const [resource, { volume, lastUsed }] of Object.entries(
      db.data.resources.volumes,
    )) {
      if (!hasDockerVolume(volume, savedVolumes)) {
        delete db.data.resources.volumes[resource];
        continue;
      }

      if (
        market_required_volumes.findIndex((vol) => vol.url === resource) !== -1
      )
        continue;

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));

      if (hoursSinceLastUsed > 24) {
        try {
          await docker.getVolume(volume).remove({ force: true });
          delete db.data.resources.volumes[resource];
        } catch (err) {
          chalk.red(`Could not remove remote resource: ${resource}.\n${err}`);
        }
      }
    }

    db.write();
  };

  /**
   * Return volume from volume db
   * @param resourceName
   * @returns string | undefined
   */
  const getVolume = (resourceName: string): string | undefined => {
    return db.data.resources.volumes[resourceName]?.volume;
  };

  /**
   * Verifies DB volume exists
   * @param resourceName
   * @returns Promise<boolean>
   */
  const hasVolume = async (resourceName: string): Promise<boolean> => {
    let result: boolean;
    const volume = getVolume(resourceName);

    if (!volume) return false;

    try {
      const vol = await docker.getVolume(volume);
      result = vol ? true : false;
    } catch (_) {
      result = false;
    }

    if (!result) {
      delete db.data.resources.volumes[resourceName];
      db.write();
    }

    return result;
  };

  /**
   * Sets volume history in db
   * @param bucket
   * @param volume
   */
  const setVolume = (bucket: string, volume: string): void => {
    db.data.resources.volumes[bucket] = {
      volume,
      lastUsed: new Date(),
      usage: db.data.resources.volumes[bucket]?.usage + 1 || 1,
    };

    db.write();
  };

  return {
    getVolume,
    hasVolume,
    setVolume,
    resyncResourcesDB,
    pullMarketRequiredVolumes,
  };
}
