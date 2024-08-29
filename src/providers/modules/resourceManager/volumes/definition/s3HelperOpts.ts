import { ContainerCreateOptions } from 'dockerode';

import {
  RequiredResource,
  Resource,
  S3Secure,
} from '../../../../../types/resources.js';

export const s3HelperImage =
  'registry.hub.docker.com/nosana/remote-resource-helper:0.3.0';

export const createS3HelperOpts = (
  volumeName: string,
  s3: RequiredResource | Resource,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: true,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: ['index.js', s3.url, s3.files ? s3.files.join(',') : ''],
  Image: s3HelperImage,
  Env: (s3 as S3Secure).IAM
    ? [
        `REGION=${(s3 as S3Secure).IAM.REGION}`,
        `ACCESS_KEY_ID=${(s3 as S3Secure).IAM.ACCESS_KEY_ID}`,
        `SECRET_ACCESS_KEY=${(s3 as S3Secure).IAM.SECRET_ACCESS_KEY}`,
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
