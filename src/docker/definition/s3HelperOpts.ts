import { ContainerCreateOptions } from 'dockerode';

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
  Env: s3.credinatials
    ? [
        `ACCESS_KEY_ID=${s3.credinatials.ACCESS_KEY_ID}`,
        `SECERT_ACCESS_KEY=${s3.credinatials.SECERT_ACCESS_KEY}`,
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
