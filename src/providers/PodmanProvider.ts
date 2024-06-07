import { DockerProvider, type RunContainerArgs } from './DockerProvider.js';
import { ifStringCastToArray } from '../generic/utils.js';
import { Container } from 'dockerode';

export class PodmanProvider extends DockerProvider {
  private apiUrl: string;

  constructor(podman: string, configLocation: string) {
    super(podman, configLocation);
    this.apiUrl = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
  }
  public async runContainer(
    image: string,
    {
      name,
      networks,
      cmd,
      gpu,
      volumes,
      env,
      work_dir,
      entrypoint,
    }: RunContainerArgs,
  ): Promise<Container> {
    const devices = gpu
      ? [
          {
            path: 'nvidia.com/gpu=all',
          },
        ]
      : [];

    const options = {
      image,
      name,
      command: cmd,
      volumes,
      ...(entrypoint
        ? { entrypoint: ifStringCastToArray(entrypoint) }
        : undefined),
      env,
      devices,
      netns: { nsmode: 'bridge' },
      Networks: networks,
      create_working_dir: true,
      cgroups_mode: 'disabled',
      work_dir,
    };
    // create container
    const create = await fetch(`${this.apiUrl}/containers/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    // start container and handle logs
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
    throw new Error('Cannot create container' + (await create.json()).message);
  }
}
