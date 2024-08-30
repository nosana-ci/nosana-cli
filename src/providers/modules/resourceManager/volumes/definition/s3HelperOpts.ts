import { ContainerCreateOptions } from 'dockerode';

import { S3Auth } from '../../../../../types/resources.js';

export const s3HelperImage =
  'registry.hub.docker.com/nosana/remote-resource-helper:0.3.0';

export const createS3HelperOpts = (
  volumeName: string,
  s3: {
    url: string;
    files?: string[];
  },
  s3Auth: S3Auth | undefined,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: true,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: ['index.js', s3.url, s3.files ? s3.files.join(',') : ''],
  Image: s3HelperImage,
  Env: s3Auth
    ? [
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
