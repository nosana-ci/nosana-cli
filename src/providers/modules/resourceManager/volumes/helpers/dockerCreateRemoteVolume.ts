import { SingleBar, Presets } from 'cli-progress';

import { convertFromBytes } from './convertFromBytes.js';
import { createS3HelperOpts } from '../definition/s3HelperOpts.js';
import { DockerExtended } from '../../../../../docker/index.js';
import Logger from '../../../logger/index.js';

import {
  RequiredResource,
  Resource,
  S3Secure,
} from '../../../../../types/resources.js';
import { extractLogsAndResultsFromLogBuffer } from '../../../../utils/extractLogsAndResultsFromLogBuffer.js';

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

  let progressBar: SingleBar | undefined;
  let formatSize: 'gb' | 'mb' | 'kb' = 'kb';

  const logStream = await container.logs({
    stdout: true,
    stderr: false,
    follow: true,
  });

  logStream.on('data', (logBuffer) => {
    try {
      const logString = logBuffer.toString('utf8');
      const logJSON = JSON.parse(logString);

      if (!progressBar) {
        const { value, format } = convertFromBytes(logJSON.size.total);
        formatSize = format;
        progressBar = new SingleBar(
          {
            format: `{bar} {percentage}% | {value}/{total}${format} | {valueFiles}/{totalFiles} files`,
          },
          Presets.shades_classic,
        );
        progressBar.start(value, 0, {
          valueFiles: 0,
          totalFiles: logJSON.count.total,
        });
      } else {
        const { value } = convertFromBytes(logJSON.size.current, formatSize);
        progressBar.update(value, {
          valueFiles: logJSON.count.current,
        });
      }
    } catch {}
  });

  const { StatusCode } = await container.wait({ condition: 'not-running' });

  progressBar?.stop();

  // If download failed, remove volume
  if (StatusCode !== 0) {
    const errrorBuffer = await container.logs({
      stdout: false,
      stderr: true,
      follow: false,
    });

    const { logs } = extractLogsAndResultsFromLogBuffer(
      errrorBuffer,
      undefined,
    );

    console.log(logs);

    const volume = await docker.getVolume(volumeName);
    await volume.remove();
    throw new Error('Cannot fetch resource.');
  }

  await container.remove({ force: true });
}

export async function createRemoteDockerVolume(
  docker: DockerExtended,
  resource: RequiredResource | Resource,
  logger?: Logger,
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
      if (logger) {
        logger.log(`Fetching resources from ${bucket.url}`, true);
      }

      await runRemoteDockerVolume(volumeName, bucket, docker);

      if (logger) {
        logger.succeed();
      }
    }
  }

  return volumeName;
}
