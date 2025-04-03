import { ContainerCreateOptions } from 'dockerode';

import { s3HelperImage } from '../definition/index.js';

export const createHFArgs = (
  volumeName: string,
  hf: {
    repo: string;
    revision?: string;
  },
  accessToken?: string | undefined,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: false,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: ['HF', hf.repo, hf.revision ?? ''],
  Image: s3HelperImage,
  Env: accessToken ? [`HUGGING_FACE_TOKEN=${accessToken}`] : undefined,
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
