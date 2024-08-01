import { Image, ImageInfo } from 'dockerode';
import { DockerExtended } from '../docker';

export type CorrectedImageInfo = ImageInfo & { Names: string[] };

export class DockerodeMock extends DockerExtended {
  private images: CorrectedImageInfo[] = [];

  constructor(images?: string[]) {
    super();

    if (images) {
      for (const img of images) {
        this.addMockImage([img]);
      }
    }
  }

  addMockImage(Names: string[]): void {
    this.images.push({
      Names,
      Id: '',
      ParentId: '',
      RepoTags: Names,
      Created: 0,
      Size: 0,
      VirtualSize: 0,
      SharedSize: 0,
      Labels: {},
      Containers: 0,
    });
  }

  listImages(): Promise<CorrectedImageInfo[]> {
    return new Promise<CorrectedImageInfo[]>((resolve) => resolve(this.images));
  }

  getImage(name: string): Image {
    return {
      modem: undefined,
      id: name,
      inspect: jest.fn(),
      history: jest.fn(),
      push: jest.fn(),
      remove: (_: {}) => {
        return new Promise((resolve) => {
          this.images = this.images.filter((x) => !x.Names.includes(name));
          resolve(true);
        });
      },
      get: jest.fn(),
      tag: jest.fn(),
      distribution: jest.fn(),
    };
  }
}
