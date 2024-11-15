import createClient from 'openapi-fetch';

import { paths } from './schema.js';
import { configs } from '../services/NodeManager/configs/nodeConfigs.js';

type CreateClient = ReturnType<typeof createClient<paths>>;

export const clientSelector = (): CreateClient => {
  let instance: CreateClient | undefined = undefined;

  if (!instance) {
    instance = createClient<paths>({
      baseUrl: configs().backendUrl?.replace('/api', '') || '',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return instance;
};
