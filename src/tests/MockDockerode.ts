import Dockerode, { Image, ImageInfo } from 'dockerode';

export type CorrectedImageInfo = ImageInfo & { Names: string[] };

export class DockerodeMock extends Dockerode {
  public images: CorrectedImageInfo[] = [];
  addMockImage!: (Names: string[]) => void;
}

DockerodeMock.prototype.addMockImage = function (Names: string[]): void {
  this.images.push({
    Names,
    Id: '',
    ParentId: '',
    RepoTags: undefined,
    Created: 0,
    Size: 0,
    VirtualSize: 0,
    SharedSize: 0,
    Labels: {},
    Containers: 0,
  });
};

DockerodeMock.prototype.listImages = function (): Promise<
  CorrectedImageInfo[]
> {
  return new Promise<CorrectedImageInfo[]>((resolve) => resolve(this.images));
};

DockerodeMock.prototype.getImage = function (name: string): Image {
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
};
