import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider.js';
import { createImageManager } from './images/index.js';
import { createVolumeManager } from './volumes/index.js';
import { DockerExtended } from '../../../docker/index.js';
import { clientSelector } from '../../../api/client.js';
import { RequiredResource, Resource } from '../../../types/resources.js';
import Logger from '../logger/index.js';

export type ResourceManager = {
  resyncResourcesDB: () => Promise<void>;
  fetchMarketRequiredResources: (market: string) => Promise<void>;
  prune: () => Promise<void>;
  images: {
    setImage: (image: string) => void;
  };
  volumes: {
    getVolume: (resource: string) => string | undefined;
    hasVolume: (resource: string) => Promise<boolean>;
    setVolume: (bucket: string, volume: string) => void;
    createRemoteVolume: (
      resource: RequiredResource | Resource,
    ) => Promise<string>;
  };
};

export function createResourceManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
  logger: Logger,
): ResourceManager {
  let required_market: string;
  const imageManager = createImageManager(db, docker, logger);
  const volumeManager = createVolumeManager(db, docker, logger);

  const resyncResourcesDB = async (): Promise<void> => {
    logger.log(chalk.cyan('Syncing Resources'), true);

    await imageManager.resyncImagesDB();
    await volumeManager.resyncResourcesDB();

    if (required_market) {
      await fetchMarketRequiredResources(required_market);
    } else {
      logger.succeed('Synced Resources');
    }
  };

  const fetchMarketRequiredResources = async (
    market: string,
  ): Promise<void> => {
    logger.log(chalk.cyan('Fetching latest market resource requirements'));

    required_market = market;

    const { data, error } = await clientSelector().GET(
      '/api/markets/{id}/required-resources',
      { params: { path: { id: market } } },
    );

    if (error)
      throw new Error(
        `Failed to fetch market resource requirements.\n${error.message}`,
      );

    await imageManager.pullMarketRequiredImages(data.required_images);
    await volumeManager.pullMarketRequiredVolumes(
      data.required_remote_resources,
    );

    logger.succeed(chalk.green('Fetched market all required resources'));
  };

  const prune = async (): Promise<void> => {
    await imageManager.pruneImages();
    await volumeManager.pruneVolumes();
  };

  return {
    resyncResourcesDB,
    fetchMarketRequiredResources,
    prune,
    images: {
      setImage: imageManager.setImage,
    },
    volumes: {
      getVolume: volumeManager.getVolume,
      hasVolume: volumeManager.hasVolume,
      setVolume: volumeManager.setVolume,
      createRemoteVolume: volumeManager.createRemoteVolume,
    },
  };
}
