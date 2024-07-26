import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider';
import { createImageManager } from './images';
import { createVolumeManager } from './volumes';
import { DockerExtended } from '../../../docker';

export function createResourceManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
) {
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
    console.log(chalk.cyan('Checking market resource requirments'));

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
      setVolume: volumeManager.setVolume,
    },
  };
}
