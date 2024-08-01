import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../../BasicProvider.js';
import { DockerExtended } from '../../../../docker/index.js';
import { hoursSinceDate } from '../utils/hoursSinceDate.js';
import Logger from '../../logger/index.js';

export type ImageManager = {
  setImage: (image: string) => void;
  resyncImagesDB: () => Promise<void>;
  pullMarketRequiredImages: (required_images: string[]) => Promise<void>;
};

/**
 * Creates Image Manager Sub-module
 * @param db
 * @param docker
 * @returns
 */
export function createImageManager(
  db: LowSync<NodeDb>,
  docker: DockerExtended,
  logger: Logger,
): ImageManager {
  let fetched = false;
  let market_required_images: string[] = [];

  const pullMarketRequiredImages = async (
    required_images: string[],
  ): Promise<void> => {
    fetched = true;
    market_required_images = required_images;
    for (const image of market_required_images) {
      if (await docker.hasImage(image)) {
        logger.log(chalk.cyan(`Pulling image ${chalk.bold(image)}`));
        try {
          await docker.promisePull(image);
        } catch (error: any) {
          throw new Error(chalk.red(`Cannot pull image ${image}: `) + error);
        }

        setImage(image);
      }
    }
  };

  /**
   * Removes previously used images that are no longer cached from the image db
   * @returns Promise
   */
  const resyncImagesDB = async (): Promise<void> => {
    for (const [image, { lastUsed, required }] of Object.entries(
      db.data.resources.images,
    )) {
      if (!(await docker.hasImage(image))) {
        delete db.data.resources.images[image];
        continue;
      }

      if ((!fetched && required) || market_required_images.includes(image))
        continue;

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));

      if (hoursSinceLastUsed > 24) {
        try {
          await docker.getImage(image).remove({ force: true });
          delete db.data.resources.images[image];
        } catch (err) {
          throw new Error(
            `Could not remove removeDanglingImages image: ${image}.\n${err}`,
          );
        }
      }
    }

    db.write();
  };

  /**
   * Sets image in nosana db
   * @param image
   * @param required
   */
  const setImage = (image: string): void => {
    db.data.resources.images[image] = {
      required: market_required_images.includes(image),
      lastUsed: new Date(),
      usage: db.data.resources.images[image]?.usage + 1 || 1,
    };

    db.write();
  };

  return {
    setImage,
    resyncImagesDB,
    pullMarketRequiredImages,
  };
}
