import { ContainerCreateOptions } from 'dockerode';

import { S3Resource } from '../../types/resources.js';

export const createS3HelperOpts = (
  volumeName: string,
  s3: S3Resource,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: true,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: ['index.js', s3.bucket],
  Image: 'docker.io/matthammond962/s3-helper',
  Env: s3.IAM
    ? [
        `ACCESS_KEY_ID=${s3.IAM.ACCESS_KEY_ID}`,
        `SECRET_ACCESS_KEY=${s3.IAM.SECRET_ACCESS_KEY}`,
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
