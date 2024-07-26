import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';
import ora from 'ora';

import { NodeDb } from '../../../BasicProvider';
import { DockerExtended } from '../../../../docker';
import { getMarketRequiredVolumes } from './helpers/getMarketRequiredVolume';
import { hasDockerVolume } from './helpers/hasDockerVolume';
import { hoursSinceDate } from '../utils/hoursSinceDate';

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
  let market_address: string;
  let market_required_volumes: S3Resource[];

  /**
   * Fetch market required volumes
   * @param market
   */
  const fetchMarketRequiredVolumes = async (market: string) => {
    market_address = market;
    market_required_volumes = getMarketRequiredVolumes(market);

    const savedVolumes = db.data.resources.volumes;

    for (const resource of market_required_volumes) {
      if (!savedVolumes[resource.bucket]) {
        const spinner = ora(
          chalk.cyan(`Fetching remote resource ${chalk.bold(resource.bucket)}`),
        ).start();

        try {
          const volumeName = await docker.createRemoteVolume(resource);
          setVolume(resource.bucket, volumeName);
        } catch (err) {
          throw new Error(
            chalk.red(`Cannt pull remote resource ${resource.bucket}:\n`) + err,
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
    if (market_address) {
      await fetchMarketRequiredVolumes(market_address);
    }

    const savedVolumes = (await docker.listVolumes()).Volumes;

    for (const [resource, { volume, lastUsed }] of Object.entries(
      db.data.resources.volumes,
    )) {
      if (!hasDockerVolume(volume, savedVolumes)) {
        delete db.data.resources.volumes[resource];
        continue;
      }

      if (
        market_address &&
        market_required_volumes.findIndex((vol) => vol.bucket === resource) !==
          -1
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
    setVolume,
    resyncResourcesDB,
    fetchMarketRequiredVolumes,
  };
}
