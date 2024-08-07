import createClient from 'openapi-fetch';

import { paths } from './schema.js';

type CreateClient = ReturnType<typeof createClient<paths>>;

export const clientSelector = (): CreateClient => {
  let instance: CreateClient | undefined = undefined;

  if (!instance) {
    instance = createClient<paths>({
      baseUrl: process.env.BACKEND_URL?.replace('/api', '') || '',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return instance;
};
