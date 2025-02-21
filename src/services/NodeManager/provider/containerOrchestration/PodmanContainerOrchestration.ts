import { Container } from 'dockerode';
import { ReturnedStatus } from '../types.js';
import { DockerContainerOrchestration } from './DockerContainerOrchestration.js';
import { RunContainerArgs } from './interface.js';
import { createPodmanRunOptions } from '../../../../providers/utils/createPodmanRunOptions.js';

export class PodmanContainerOrchestration extends DockerContainerOrchestration {
  private api: string;
  public name: string = 'podman';

  constructor(server: string, gpu: string) {
    super(server, gpu);
    this.api = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
  }

  async runFlowContainer(
    image: string,
    args: RunContainerArgs,
  ): Promise<ReturnedStatus<Container>> {
    let error;
    // Incase of error, retry 3 times
    for (let i = 0; i < 3; i++) {
      // Sleep between retries to try and let podman image copying finalise
      await new Promise((res) => setTimeout(res, 3000 * i));

      const create = await fetch(`${this.api}/containers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPodmanRunOptions(image, args, this.gpu)),
      });

      if (create.status === 201) {
        const createResult = await create.json();

        const start = await fetch(
          `${this.api}/containers/${createResult.Id}/start`,
          {
            method: 'POST',
          },
        );
        if (start.status === 204) {
          const container = this.docker.getContainer(createResult.Id);
          this.setupContainerAbortion(container.id);
          return { status: true, result: container };
        } else {
          return {
            status: false,
            error: new Error(
              'Cannot start container: ' + (await start.json()).message,
            ),
          };
        }
      }

      error = await create.json();
      if (error.message !== `${image}: image not known`) break;
    }

    return { status: false, error };
  }
}
