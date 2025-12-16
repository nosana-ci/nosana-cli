import type { JobDefinition } from '@nosana/sdk';

export const privateBlankJobDefintion: JobDefinition = {
  version: '0.1',
  type: 'container',
  meta: {
    trigger: 'cli',
  },
  logistics: {
    send: {
      type: 'api-listen',
      args: {},
    },
    receive: {
      type: 'api-listen',
      args: {},
    },
  },
  ops: [],
};
