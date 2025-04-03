import { ContainerCreateOptions } from 'dockerode';
import { S3Auth } from '@nosana/sdk/dist/types/resources';

import { nosanaBucket, s3HelperImage } from '../definition/index.js';

export const createS3Args = (
  volumeName: string,
  s3: {
    url: string;
    files?: string[];
    bucket?: string;
  },
  s3Auth: S3Auth | undefined,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: false,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: [
    'S3',
    s3.url.replace('s3://nos-ai-models-qllsn32u', nosanaBucket),
    s3.files ? s3.files.join(',') : '',
  ],
  Image: s3HelperImage,
  Env: s3Auth
    ? [
        s3.bucket ? `BUCKET=${s3.bucket}` : '',
        `REGION=${s3Auth.REGION}`,
        `ACCESS_KEY_ID=${s3Auth.ACCESS_KEY_ID}`,
        `SECRET_ACCESS_KEY=${s3Auth.SECRET_ACCESS_KEY}`,
      ]
    : undefined,
  HostConfig: {
    Mounts: [
      {
        Target: '/s3/temp',
        Source: volumeName,
        Type: 'volume',
      },
    ],
  },
});
