import createClient from 'openapi-fetch';

import { paths } from './schema.js';
import { configs } from '../services/NodeManager/configs/configs.js';

export type QueryClient = ReturnType<typeof createClient<paths>>;

export const clientSelector = (): QueryClient => {
  let instance: QueryClient | undefined = undefined;

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
