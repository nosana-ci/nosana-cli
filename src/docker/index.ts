import Dockerode from 'dockerode';

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

    let imageWithTag = `${image}${!image.includes(':') ? ':latest' : ''}`;

    const possible_options = [
      `docker.io/${imageWithTag}`,
      `docker.io/library/${imageWithTag}`,
      `registry.hub.docker.com//${imageWithTag}`,
      `registry.hub.docker.com/library/${imageWithTag}`,
    ];

    return savedImages.some(({ RepoTags }, index) => {
      if (RepoTags && RepoTags.some((tag) => possible_options.includes(tag)))
        return index;
    });
  }
}
