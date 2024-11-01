import { Presets, SingleBar } from 'cli-progress';
import { S3Secure } from '@nosana/sdk/dist/types/resources';

import { DockerExtended } from '../../../../../docker/index.js';
import { createS3HelperOpts } from '../definition/s3HelperOpts.js';
import { convertFromBytes } from './convertFromBytes.js';
import { extractLogsAndResultsFromLogBuffer } from '../../../../utils/extractLogsAndResultsFromLogBuffer.js';

export async function runResourceManagerContainer(
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

  const controller = new AbortController();
  let progressBar: SingleBar | undefined;
  let formatSize: 'gb' | 'mb' | 'kb' = 'kb';

  const logStream = await container.logs({
    stdout: true,
    stderr: false,
    follow: true,
    abortSignal: controller.signal,
  });

  logStream.on('data', (logBuffer) => {
    try {
      const logString: string = logBuffer.toString('utf8');
      const logJSON = JSON.parse(logString.slice(8, logString.length - 1));
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
  controller.abort();

  progressBar?.stop();

  // If download failed, remove volume
  if (StatusCode !== 0) {
    console.log('error');
    const errrorBuffer = await container.logs({
      follow: false,
      stdout: false,
      stderr: true,
    });

    const { logs } = extractLogsAndResultsFromLogBuffer(
      errrorBuffer,
      undefined,
    );

    await container.remove({ force: true });

    const volume = await docker.getVolume(volumeName);
    await volume.remove();

    const lastLog = logs[logs.length - 1].log?.replaceAll('\n', '');
    const jsonLog = lastLog ? JSON.parse(lastLog) : { message: 'Unkown Error' };
    throw new Error(jsonLog.message);
  }

  await container.remove({ force: true });
}
