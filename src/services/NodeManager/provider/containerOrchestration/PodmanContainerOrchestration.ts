import { Container } from 'dockerode';
import { ReturnedStatus } from '../types.js';
import { DockerContainerOrchestration } from './DockerContainerOrchestration.js';
import { RunContainerArgs } from './interface.js';
import { createPodmanRunOptions } from '../../../../providers/utils/createPodmanRunOptions.js';
import { fetch, Agent, RequestInit, Response } from 'undici';

export class PodmanContainerOrchestration extends DockerContainerOrchestration {
  private api: string;
  public name: string = 'podman';

  constructor(server: string, gpu: string) {
    super(server, gpu);
    if (this.protocol === 'socket') {
      this.api = `http://localhost/v4.5.0/libpod`;
    } else {
      this.api = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
    }
  }

  async libPodAPICall(path: string, options: RequestInit): Promise<Response> {
    if (this.protocol === 'socket') {
      options.dispatcher = new Agent({
        connect: {
          socketPath: this.host,
        },
      });
    }

    return fetch(`${this.api}${path}`, options);
  }

  async runFlowContainer(
    image: string,
    args: RunContainerArgs,
    controller?: AbortController,
  ): Promise<Container> {
    let error: any;
    // Incase of error, retry 3 times
    for (let i = 0; i < 3; i++) {
      // Sleep between retries to try and let podman image copying finalise
      await new Promise((res) => setTimeout(res, 3000 * i));
      const create = await this.libPodAPICall(`/containers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPodmanRunOptions(image, args, this.gpu)),
      });

      if (create.status === 201) {
        const createResult: any = await create.json();
        const start = await this.libPodAPICall(
          `/containers/${createResult.Id}/start`,
          {
            method: 'POST',
          },
        );
        if (start.status === 204) {
          const container = this.docker.getContainer(createResult.Id);
          if (controller) {
            this.setupContainerAbortListener(container.id, controller);
          }
          return container;
        } else {
          throw new Error(
            'Cannot start container: ' + ((await start.json()) as any).message,
          );
        }
      }

      error = await create.json();
      if (error.message !== `${image}: image not known`) break;
    }

    throw error;
  }
}
