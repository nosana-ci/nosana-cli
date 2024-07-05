import chalk from 'chalk';
import Dockerode, { ImageInfo } from 'dockerode';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider';

type CorrectedImageInfo = ImageInfo & { Names: string[] };

export type ImageManager = {
  setImage: (image: string) => void;
  removeDangalingImages: () => Promise<void>;
};

/**
 * Creates Image Manager Module
 * @param db
 * @param docker
 * @returns
 */
export function createImageManager(
  db: LowSync<NodeDb>,
  docker: Dockerode,
): ImageManager {
  // This should soon come from the markets and not hard coded!
  const market_required_images: string[] = [
    'registry.hub.docker.com/nosana/stats:v1.0.4',
  ];

  /**
   * Removes previously used images from the image db
   * @returns Promise
   */
  const resyncImagesDB = async (): Promise<void> => {
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    for (const image of Object.keys(db.data.images)) {
      if (savedImages.findIndex((x) => x.Names.includes(image)) === -1) {
        delete db.data.images[image];
      }
    }

    db.write();
  };

  /**
   * Remove all dangaling unrequired images not used within the last 24hours
   *  @returns Promise
   */
  const removeDangalingImages = async (): Promise<void> => {
    for (const [image, history] of Object.entries(db.data.images)) {
      if (!market_required_images.includes(image)) {
        const hoursSinceLastUsed =
          Math.abs(
            new Date(history.lastUsed).getTime() - new Date().getTime(),
          ) / 36e5;

        if (hoursSinceLastUsed > 24) {
          try {
            await docker.getImage(image).remove({ force: true });
            delete db.data.images[image];
          } catch (err) {
            chalk.red(`Could not remove dangagling image: ${image}. ${err}`);
          }
        }
      }
    }

    db.write();
  };

  /**
   * Set image usage data in db
   * @returns
   */
  const handleSetImage = (image: string): void => {
    db.data.images[image] = {
      lastUsed: new Date(),
      usage: db.data.images[image] ? db.data.images[image].usage + 1 : 1,
    };

    db.write();
  };

  resyncImagesDB();

  return {
    setImage: handleSetImage,
    removeDangalingImages,
  };
}
