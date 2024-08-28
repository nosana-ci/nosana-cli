import Dockerode from 'dockerode';

import { repoTagsContainsImage } from './utils/repoTagsContainsImage.js';

export class DockerExtended extends Dockerode {
  async promisePull(image: string) {
    return await new Promise((resolve, reject): any =>
      this.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
        } else {
          this.modem.followProgress(
            stream,
            (err: any, output: any) => onFinished(err, output),
            onProgress,
          );
        }
        async function onFinished(err: any, _: any) {
          if (!err) {
            resolve(true);
            return;
          }
          reject(err);
        }
        function onProgress(event: any) {
          // TODO: multiple progress bars happening at the same time, how do we show this?
        }
      }),
    );
  }

  async hasImage(image: string): Promise<boolean> {
    const savedImages = await this.listImages();

    return savedImages.some(({ RepoTags }) =>
      repoTagsContainsImage(image, RepoTags),
    );
  }
}
