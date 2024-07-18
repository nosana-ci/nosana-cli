import ora from 'ora';
import chalk from 'chalk';
import Dockerode, { ImageInfo } from 'dockerode';
import { LowSync } from 'lowdb/lib';

import { NodeDb } from '../../BasicProvider.js';
import { getMarketRequiredImages } from './helpers/getMarketRequiredImages.js';
import { hasDockerImage } from './helpers/hasDockerImage.js';
import { dockerPromisePull } from '../../utils/dockerPromisePull.js';

type CorrectedImageInfo = ImageInfo & { Names: string[] };

export type ImageManager = {
  setImage: (image: string) => void;
  resyncImagesDB: () => Promise<void>;
  fetchMarketRequiredImages: (market: string) => Promise<void>;
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
  let market_address: string;
  let market_required_images: string[] = [];

  const fetchMarketRequiredImages = async (market: string): Promise<void> => {
    market_address = market;
    market_required_images = await getMarketRequiredImages(market);
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    console.log(chalk.cyan('Checking market resource requirments'));

    for (const image of market_required_images) {
      if (!hasDockerImage(image, savedImages)) {
        const spinner = ora(
          chalk.cyan(`Pulling image ${chalk.bold(image)}`),
        ).start();
        try {
          await dockerPromisePull(image, docker);
        } catch (error: any) {
          throw new Error(chalk.red(`Cannot pull image ${image}: `) + error);
        }
        spinner.succeed();
      }
    }

    console.log(chalk.green('Fetched market all required resources'));
  };

  /**
   * Removes previously used images that are no longer cached from the image db
   * @returns Promise
   */
  const resyncImagesDB = async (): Promise<void> => {
    if (market_address) {
      await fetchMarketRequiredImages(market_address);
    }
    const savedImages = (await docker.listImages()) as CorrectedImageInfo[];

    for (const [image, history] of Object.entries(db.data.images)) {
      if (!hasDockerImage(image, savedImages)) {
        delete db.data.images[image];
        continue;
      }

      if (market_address && !market_required_images.includes(image)) {
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
    db.data.images[image] = {
      lastUsed: new Date(),
      usage: db.data.images[image]?.usage + 1 || 1,
    };

    db.write();
  };

  return {
    setImage,
    resyncImagesDB,
    fetchMarketRequiredImages,
  };
}
