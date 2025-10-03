import { ContainerCreateOptions } from 'dockerode';

import { s3HelperImage } from '../definition/index.js';

export const createOllamaArgs = (
  volumeName: string,
  model: string,
): ContainerCreateOptions => ({
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Tty: false,
  OpenStdin: false,
  StdinOnce: false,
  Cmd: ['Ollama', model],
  Image: s3HelperImage,
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
