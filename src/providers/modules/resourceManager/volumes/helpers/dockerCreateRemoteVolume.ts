import { DockerExtended } from '../../../../../docker/index.js';
import { RequiredResource, Resource } from '../../../../../types/resources.js';
import { createS3HelperOpts } from '../definition/s3HelperOpts.js';

export async function createRemoteDockerVolume(
  docker: DockerExtended,
  resource: RequiredResource | Resource,
): Promise<string> {
  // TODO: Add download progress status
  // TODO: if exists we could add a sync feature to ensure it will reflect any changes

  // Create the volume// Create the volume
  let volumeName: string;
  const response = await docker.createVolume();

  // @ts-ignore **PODMAN returns name not Name**
  if (response.name) volumeName = response.name;
  else volumeName = response.Name;

  // Create S3 helper container with the new volume mounted
  const container = await docker.createContainer(
    createS3HelperOpts(volumeName, resource),
  );
  await container.start();

  // Wait until container has finished fetching
  const { StatusCode } = await container.wait({ condition: 'not-running' });
  await container.remove({ force: true });

  // If download failed, remove volume
  if (StatusCode !== 0) {
    const volume = await docker.getVolume(volumeName);
    await volume.remove();
    throw new Error('Cannot fetch resource.');
  }

  return volumeName;
}
