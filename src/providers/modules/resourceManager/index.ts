import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider';
import { createImageManager } from './images';
import { createVolumeManager } from './volumes';
import { DockerExtended } from '../../../docker';

export type ResourceManager = {
  resyncResourcesDB: () => Promise<void>;
  fetchMarketRequiredResources: (market: string) => Promise<void>;
  images: {
    setImage: (image: string) => void;
  };
  volumeManager: {
    getVolume: (resource: string) => string | undefined;
    hasVolume: (resource: string) => Promise<boolean>;
    setVolume: (bucket: string, volume: string) => void;
  };
};

export function createResourceManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
): ResourceManager {
  const imageManager = createImageManager(db, docker);
  const volumeManager = createVolumeManager(db, docker);

  const resyncResourcesDB = async (): Promise<void> => {
    console.log(chalk.cyan('Syncing Resources'));
    await imageManager.resyncImagesDB();
    await volumeManager.resyncResourcesDB();
  };

  const fetchMarketRequiredResources = async (
    market: string,
  ): Promise<void> => {
    console.log(chalk.cyan('Checking market resource requirements'));

    await imageManager.fetchMarketRequiredImages(market);
    await volumeManager.fetchMarketRequiredVolumes(market);

    console.log(chalk.green('Fetched market all required resources'));
  };

  return {
    resyncResourcesDB,
    fetchMarketRequiredResources,
    images: {
      setImage: imageManager.setImage,
    },
    volumeManager: {
      getVolume: volumeManager.getVolume,
      hasVolume: volumeManager.hasVolume,
      setVolume: volumeManager.setVolume,
    },
  };
}
