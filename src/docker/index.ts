import Dockerode from 'dockerode';

import { S3Resource } from '../types/resources.js';
import { createS3HelperOpts } from './definition/s3HelperOpts.js';

export class DockerExtended extends Dockerode {
  async dockerPromisePull(image: string) {
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

  /**
   *
   * @param s3Bucket
   */
  async createRemoteVolume(resource: S3Resource): Promise<string> {
    // TODO: check again database and volumes to see if it already exists
    // TODO: if exists we could add a sync feature to ensure it will reflect any changes
    try {
      // Create the volume// Create the volume
      let volumeName: string;
      const response = await this.createVolume();

      // @ts-ignore **PODMAN returns name not Name**
      if (response.name) volumeName = response.name;
      else volumeName = response.Name;

      // Create S3 helper container with the new volume mounted
      const container = await this.createContainer(
        createS3HelperOpts(volumeName, resource),
      );
      await container.start();

      // Wait until container has finished fetching
      const { StatusCode } = await container.wait({ condition: 'not-running' });
      await container.remove({ force: true });

      // If download failed, remove volume
      if (StatusCode !== 0) {
        const volume = await this.getVolume(volumeName);
        await volume.remove();
        throw new Error('Cannot fetch resource.');
      }

      return volumeName;
    } catch (err) {
      throw new Error(`Failed to fetch resource\n${err}`);
    }
  }
}
