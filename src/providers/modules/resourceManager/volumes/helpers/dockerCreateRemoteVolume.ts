import Logger from '../../../logger/index.js';

import { RequiredResource, Resource } from '../../../../../types/resources.js';
import { runResourceManagerContainer } from './runResourceManagerContainer.js';
import { DockerExtended } from '../../../../../docker/index.js';

export async function createRemoteDockerVolume(
  docker: DockerExtended,
  resource: RequiredResource | Resource,
  logger?: Logger,
): Promise<string> {
  // TODO: if exists we could add a sync feature to ensure it will reflect any changes

  // Create the volume
  let volumeName: string;
  const response = await docker.createVolume();

  // @ts-ignore **PODMAN returns name not Name**
  if (response.name) volumeName = response.name;
  else volumeName = response.Name;

  // Create S3 helper container with the new volume mounted
  if (resource.url) {
    await runResourceManagerContainer(
      volumeName,
      {
        url: resource.url,
        files: resource.files,
      },
      docker,
    );
  } else {
    for (const bucket of resource.buckets!) {
      if (logger) {
        logger.log(`Fetching resources from ${bucket.url}`, true);
      }

      await runResourceManagerContainer(volumeName, bucket, docker);

      if (logger) {
        logger.succeed();
      }
    }
  }

  return volumeName;
}
