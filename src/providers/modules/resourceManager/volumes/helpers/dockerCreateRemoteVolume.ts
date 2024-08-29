import { DockerExtended } from '../../../../../docker/index.js';
import {
  RequiredResource,
  Resource,
  S3Secure,
} from '../../../../../types/resources.js';
import { createS3HelperOpts } from '../definition/s3HelperOpts.js';

async function runRemoteDockerVolume(
  volumeName: string,
  resource: {
    url: string;
    files?: string[];
  },
  docker: DockerExtended,
) {
  const { url, files } = resource;

  const container = await docker.createContainer(
    createS3HelperOpts(volumeName, { url, files }, (resource as S3Secure).IAM),
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
}

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
  if (resource.url) {
    await runRemoteDockerVolume(
      volumeName,
      {
        url: resource.url,
        files: resource.files,
      },
      docker,
    );
  } else {
    for (const bucket of resource.buckets!) {
      console.log(`Fetching items from bucket: ${bucket.url}`);
      await runRemoteDockerVolume(volumeName, bucket, docker);
    }
  }

  return volumeName;
}
