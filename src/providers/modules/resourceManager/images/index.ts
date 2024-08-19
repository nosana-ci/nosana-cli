import chalk from 'chalk';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../../BasicProvider.js';
import { DockerExtended } from '../../../../docker/index.js';
import { hoursSinceDate } from '../utils/hoursSinceDate.js';
import Logger from '../../logger/index.js';
import { repoTagsContainsImage } from '../../../../docker/utils/repoTagsContainsImage.js';

export type ImageManager = {
  setImage: (image: string) => void;
  resyncImagesDB: () => Promise<void>;
  pullMarketRequiredImages: (required_images: string[]) => Promise<void>;
  pruneImages: () => Promise<void>;
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
      if (!(await docker.hasImage(image))) {
        logger.log(chalk.cyan(`Pulling image ${chalk.bold(image)}`), true);

        try {
          await docker.promisePull(image);
        } catch (error: any) {
          throw new Error(chalk.red(`Cannot pull image ${image}: `) + error);
        }
        logger.succeed();
      }

      if (!db.data.resources.images[image]) setImage(image);
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

  const pruneImages = async () => {
    const cachedImages = await docker.listImages();

    for (const { Id, RepoTags } of cachedImages) {
      const dbEntry = Object.entries(db.data.resources.images).find((img) =>
        repoTagsContainsImage(img[0], RepoTags) ? img : undefined,
      );

      if (dbEntry && dbEntry[1].required) continue;

      try {
        const image = await docker.getImage(Id);
        await image.remove({ force: true });
      } catch (err) {
        logger.log(chalk.red(`Could not remove ${Id} volume.\n${err}`));
      }

      if (dbEntry) delete db.data.resources.images[dbEntry[0]];
    }

    db.write();
  };

  return {
    setImage,
    resyncImagesDB,
    pullMarketRequiredImages,
    pruneImages,
  };
}
