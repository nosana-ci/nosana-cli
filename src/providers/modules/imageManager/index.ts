import chalk from 'chalk';
import Dockerode, { ImageInfo } from 'dockerode';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider';
import { x } from 'tar';

type CorrectedImageInfo = ImageInfo & { Names: string[] };

export type ImageManager = {
  setImage: (image: string) => void;
  resyncImagesDB: () => Promise<void>;
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
   * Removes previously used images that are no longer cached from the image db
   * @returns Promise
   */
  const resyncImagesDB = async (): Promise<void> => {
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    for (const [image, history] of Object.entries(db.data.images)) {
      // Removes previously used images that are no longer cached from the image db
      if (
        savedImages.findIndex(({ Names, Labels }, index) => {
          if (!Names.includes(image) || Labels[image] === undefined) return -1;
          return index;
        }) === -1
      ) {
        delete db.data.images[image];
        continue;
      }

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
            chalk.red(
              `Could not remove removeDanglingImages image: ${image}. ${err}`,
            );
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
  const setImage = (image: string): void => {
    console.log(db.data.images);

    db.data.images[image] = {
      lastUsed: new Date(),
      usage: db.data.images[image]?.usage + 1 || 1,
    };

    db.write();
  };

  return {
    setImage,
    resyncImagesDB,
  };
}
