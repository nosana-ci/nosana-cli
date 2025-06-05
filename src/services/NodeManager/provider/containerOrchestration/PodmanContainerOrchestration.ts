import { Container } from 'dockerode';
import { ReturnedStatus } from '../types.js';
import { DockerContainerOrchestration } from './DockerContainerOrchestration.js';
import { RunContainerArgs } from './interface.js';
import { createPodmanRunOptions } from '../../../../providers/utils/createPodmanRunOptions.js';
import { fetch, Agent, RequestInit, Response } from 'undici'

export class PodmanContainerOrchestration extends DockerContainerOrchestration {
  private api: string;
  public name: string = 'podman';

  constructor(server: string, gpu: string) {
    super(server, gpu);
    this.api = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
  }

  async libPodAPICall(path: string, options: RequestInit): Promise<Response> {
    return fetch(`${this.api}${path}`, {
      ...options,
      dispatcher: new Agent({
        connect: {
          socketPath: '/run/podman/podman.sock'
        }
      })
    })
  }

  async runFlowContainer(
    image: string,
    args: RunContainerArgs,
    addAbortListener = true,
  ): Promise<ReturnedStatus<Container>> {
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
        const start = await this.libPodAPICall(`/containers/${createResult.Id}/start`, {
          method: 'POST',
        });
        if (start.status === 204) {
          const container = this.docker.getContainer(createResult.Id);
          if (addAbortListener) {
            this.setupContainerAbortListener(container.id);
          }
          return { status: true, result: container };
        } else {
          return {
            status: false,
            error: new Error(
              'Cannot start container: ' + ((await start.json()) as any).message,
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
