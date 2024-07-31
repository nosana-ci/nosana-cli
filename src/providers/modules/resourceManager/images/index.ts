import ora from 'ora';
import chalk from 'chalk';
import { ImageInfo } from 'dockerode';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../../BasicProvider.js';
import { hasDockerImage } from './helpers/hasDockerImage.js';
import { DockerExtended } from '../../../../docker/index.js';
import { hoursSinceDate } from '../utils/hoursSinceDate.js';

type CorrectedImageInfo = ImageInfo & { Names: string[] };

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
): ImageManager {
  let market_required_images: string[] = [];

  const pullMarketRequiredImages = async (
    required_images: string[],
  ): Promise<void> => {
    market_required_images = required_images;
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    for (const image of market_required_images) {
      if (!hasDockerImage(image, savedImages)) {
        const spinner = ora(
          chalk.cyan(`Pulling image ${chalk.bold(image)}`),
        ).start();
        try {
          await docker.promisePull(image);
        } catch (error: any) {
          throw new Error(chalk.red(`Cannot pull image ${image}: `) + error);
        }

        setImage(image);
        spinner.succeed();
      }
    }
  };

  /**
   * Removes previously used images that are no longer cached from the image db
   * @returns Promise
   */
  const resyncImagesDB = async (): Promise<void> => {
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    for (const [image, { lastUsed }] of Object.entries(
      db.data.resources.images,
    )) {
      if (!hasDockerImage(image, savedImages)) {
        delete db.data.resources.images[image];
        continue;
      }

      if (market_required_images.includes(image)) continue;

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));

      if (hoursSinceLastUsed > 24) {
        try {
          await docker.getImage(image).remove({ force: true });
          delete db.data.resources.images[image];
        } catch (err) {
          chalk.red(
            `Could not remove removeDanglingImages image: ${image}. ${err}`,
          );
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
    db.data.resources.images[image] = {
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
