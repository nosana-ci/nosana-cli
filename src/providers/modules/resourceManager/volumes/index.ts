import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import Logger from '../../logger/index.js';
import { DockerExtended } from '../../../../docker/index.js';
import { hasDockerVolume } from './helpers/hasDockerVolume.js';
import { createRemoteDockerVolume } from './helpers/dockerCreateRemoteVolume.js';
import { RequiredResource, Resource } from '../../../../types/resources.js';
import { hoursSinceDate } from '../utils/hoursSinceDate.js';
import { NodeDb } from '../../db/index.js';

export function createResourceName(resource: RequiredResource) {
  if (resource.url) return resource.url;

  // TODO: Fix type to ensure that it is either url or bucket!
  return resource.buckets!.map((bucket) => bucket.url).join('-');
}

/**
 * Creates Volume Manager Sub-module
 * @param db
 * @param docker
 * @returns
 */
export function createVolumeManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
  logger: Logger,
) {
  let fetched = false;
  let market_required_volumes: RequiredResource[] = [];

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
      if (!savedVolumes[createResourceName(resource)]) {
        await createRemoteVolume(resource);
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

    for (const [resource, { volume, lastUsed, required }] of Object.entries(
      db.data.resources.volumes,
    )) {
      if (!hasDockerVolume(volume, savedVolumes)) {
        delete db.data.resources.volumes[resource];
        continue;
      }

      if (
        (!fetched && required) ||
        market_required_volumes.some(
          (vol) => createResourceName(vol) === resource,
        )
      )
        continue;

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));

      if (hoursSinceLastUsed > 24) {
        try {
          await docker.getVolume(volume).remove({ force: true });
          delete db.data.resources.volumes[resource];
        } catch (err) {
          const message = (err as { json: { message: string } }).json.message;
          logger.log(
            chalk.red(
              `Could not remove remote resource: ${resource}.\n${message}`,
            ),
          );
        }
      }
    }

    db.write();
  };

  /**
   *
   * @param s3Bucket
   */
  const createRemoteVolume = async (
    resource: RequiredResource | Resource,
  ): Promise<string> => {
    const resourceName = createResourceName(resource);
    const savedResource = await getVolume(resource);

    if (savedResource) {
      setVolume(resourceName, savedResource);
      return savedResource;
    }

    logger.log(
      chalk.cyan(`Fetching remote resource ${chalk.bold(resourceName)}`),
      true,
    );

    try {
      const volume = await createRemoteDockerVolume(docker, resource, logger);
      setVolume(resourceName, volume);
      logger.succeed();
      return volume;
    } catch (err) {
      throw new Error(`Failed to fetch remote resource\n${err}`);
    }
  };

  /**
   * Return volume from volume db
   * @param resourceName
   * @returns string | undefined
   */
  const getVolume = (
    resource: RequiredResource | Resource,
  ): string | undefined => {
    return db.data.resources.volumes[createResourceName(resource)]?.volume;
  };

  /**
   * Verifies DB volume exists
   * @param resourceName
   * @returns Promise<boolean>
   */
  const hasVolume = async (resource: Resource): Promise<boolean> => {
    let result: boolean;
    const volume = getVolume(resource);

    if (!volume) return false;

    try {
      const vol = await docker.getVolume(volume);
      result = vol ? true : false;
    } catch (_) {
      result = false;
    }

    if (!result) {
      delete db.data.resources.volumes[createResourceName(resource)];
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
      required: market_required_volumes.some(
        (vol) => createResourceName(vol) === bucket,
      ),
      lastUsed: new Date(),
      usage: db.data.resources.volumes[bucket]?.usage + 1 || 1,
    };

    db.write();
  };

  const pruneVolumes = async (): Promise<void> => {
    const cachedVolumes = (await docker.listVolumes()).Volumes;
    const dbVolume = Object.entries(db.data.resources.volumes);

    for (const { Name } of cachedVolumes) {
      const dbEntry = dbVolume.find((vol) => vol[1].volume === Name);

      if (dbEntry && dbEntry[1].required) continue;

      try {
        const volume = await docker.getVolume(Name);
        await volume.remove({ force: true });
      } catch (err) {
        logger.log(chalk.red(`Could not remove ${Name} volume.\n${err}`));
      }

      if (dbEntry) delete db.data.resources.volumes[dbEntry[0]];
    }

    db.write();
  };

  return {
    createRemoteVolume,
    getVolume,
    hasVolume,
    setVolume,
    resyncResourcesDB,
    pullMarketRequiredVolumes,
    pruneVolumes,
  };
}
