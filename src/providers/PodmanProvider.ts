import { Container } from 'dockerode';

import { createPodmanRunOptions } from './utils/createPodmanRunOptions.js';
import { DockerProvider, type RunContainerArgs } from './DockerProvider.js';
import Logger from './modules/logger/index.js';

export class PodmanProvider extends DockerProvider {
  private apiUrl: string;
  public name: string = 'podman';

  constructor(podman: string, configLocation: string, logger?: Logger) {
    super(podman, configLocation, logger);
    this.apiUrl = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
  }

  /**
   * Docker API is not compatible when creating/starting a container with GPU support
   * in podman. Therefore we use the libpod API to create and start the container.
   * @param image string
   * @param args RunContainerArgs
   * @returns Promise Container
   */
  public async runContainer(
    image: string,
    args: RunContainerArgs,
  ): Promise<Container> {
    let error;
    // Incase of error, retry 3 times
    for (let i = 0; i < 3; i++) {
      // Sleep between retries to try and let podman image copying finalise
      await new Promise((res) => setTimeout(res, 3000 * i));

      const create = await fetch(`${this.apiUrl}/containers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPodmanRunOptions(image, args)),
      });

      // start container
      if (create.status === 201) {
        const createResult = await create.json();

        const start = await fetch(
          `${this.apiUrl}/containers/${createResult.Id}/start`,
          {
            method: 'POST',
          },
        );
        if (start.status === 204) {
          const container = this.docker.getContainer(createResult.Id);
          return container;
        } else {
          throw new Error(
            'Cannot start container: ' + (await start.json()).message,
          );
        }
      }

      error = await create.json();
      if (error.message !== `${image}: image not known`) break;
    }

    throw new Error('Cannot create container: ' + error.message);
  }
}
