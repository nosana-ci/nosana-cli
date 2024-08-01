import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider.js';
import { createImageManager } from './images/index.js';
import { createVolumeManager } from './volumes/index.js';
import { DockerExtended } from '../../../docker/index.js';
import { apiClient } from '../../../api/client.js';
import { RequiredResource, Resource } from '../../../types/resources.js';
import Logger from '../logger/index.js';

export type ResourceManager = {
  resyncResourcesDB: () => Promise<void>;
  fetchMarketRequiredResources: (market: string) => Promise<void>;
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
  const imageManager = createImageManager(db, docker, logger);
  const volumeManager = createVolumeManager(db, docker, logger);

  const resyncResourcesDB = async (): Promise<void> => {
    logger.log(chalk.cyan('Syncing Resources'));
    await imageManager.resyncImagesDB();
    await volumeManager.resyncResourcesDB();
  };

  const fetchMarketRequiredResources = async (
    market: string,
  ): Promise<void> => {
    logger.log(chalk.cyan('Fetching latest market resource requirements'));

    const { data, error } = await apiClient.GET(
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

    logger.log(chalk.green('Fetched market all required resources'));
  };

  return {
    resyncResourcesDB,
    fetchMarketRequiredResources,
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
