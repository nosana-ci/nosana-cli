import { clientSelector } from '../../../../api/client.js';
import { ContainerOrchestrationInterface } from '../../provider/containerOrchestration/interface.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { ImageManager } from './image/imageManager.js';
import { VolumeManager } from './volume/volumeManager.js';

export class ResourceManager {
  private required_market: string | undefined;

  public images: ImageManager;
  public volumes: VolumeManager;

  constructor(
    private containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
  ) {
    this.images = new ImageManager(containerOrchestration, repository);
    this.volumes = new VolumeManager(containerOrchestration, repository);
  }

  public async resyncResourcesDB(): Promise<void> {
    await this.images.resyncImagesDB();
    await this.volumes.resyncResourcesDB();

    if (this.required_market) {
      await this.fetchMarketRequiredResources(this.required_market);
    }
  }

  public async fetchMarketRequiredResources(market: string): Promise<void> {
    this.required_market = market;

    const { data, error } = await clientSelector().GET(
      '/api/markets/{id}/required-resources',
      { params: { path: { id: market } } },
    );

    if (error) {
      throw new Error(error.toString());
    }

    await this.images.pullMarketRequiredImages(data.required_images);
    await this.volumes.pullMarketRequiredVolumes(
      data.required_remote_resources,
    );
  }

  public async prune(): Promise<void> {
    await this.images.pruneImages();
    await this.volumes.pruneVolumes();
  }
}
