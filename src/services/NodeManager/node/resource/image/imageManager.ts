import { applyLoggingProxyToClass } from '../../../monitoring/proxy/loggingProxy.js';
import { ContainerOrchestrationInterface } from '../../../provider/containerOrchestration/interface.js';
import { NodeRepository } from '../../../repository/NodeRepository.js';
import { hoursSinceDate } from '../helpers/hoursSunceDate.js';
import { repoTagsContainsImage } from '../helpers/repoTagsContainsImage.js';

export class ImageManager {
  private fetched: boolean = false;
  private market_required_images: string[] = [];

  constructor(
    private containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
  ) {
    applyLoggingProxyToClass(this);
  }

  public async pullMarketRequiredImages(
    required_images: string[],
  ): Promise<void> {
    this.fetched = true;
    this.market_required_images = required_images;

    for (const image of required_images) {
      if (!(await this.containerOrchestration.hasImage(image))) {
        await this.containerOrchestration.pullImage(image);
      }

      if (!this.repository.getImageResource(image)) {
        this.repository.updateImageResource(image, {
          required: true,
          lastUsed: new Date(),
          usage: 1,
        });
      }
    }
  }

  public async pruneImages(): Promise<void> {
    const cachedImages = await this.containerOrchestration.listImages();

    for (const { Id, RepoTags } of cachedImages) {
      const dbEntry = Object.entries(this.repository.getImagesResources()).find(
        (img) => (repoTagsContainsImage(img[0], RepoTags) ? img : undefined),
      );

      if (dbEntry && dbEntry[1].required) {
        continue;
      }

      await this.containerOrchestration.deleteImage(Id);

      if (dbEntry) {
        this.repository.deleteImageResource(dbEntry[0]);
      }
    }
  }

  public async resyncImagesDB(): Promise<void> {
    for (const [image, { lastUsed, required }] of Object.entries(
      this.repository.getImagesResources(),
    )) {
      if (!(await this.containerOrchestration.hasImage(image))) {
        this.repository.deleteImageResource(image);
        continue;
      }

      if (
        (!this.fetched && required) ||
        this.market_required_images.includes(image)
      ) {
        continue;
      }

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));
      if (hoursSinceLastUsed > 24) {
        await this.containerOrchestration.deleteImage(image);
        this.repository.deleteImageResource(image);
      }
    }
  }

  public async setImage(image: string): Promise<void> {
    const imageObj = this.repository.getImageResource(image);
    this.repository.updateImageResource(image, {
      required: true,
      lastUsed: new Date(),
      usage: imageObj?.usage + 1 || 1,
    });
  }
}
