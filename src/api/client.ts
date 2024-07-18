import createClient from 'openapi-fetch';

import { paths } from './schema.js';

export const apiClient = createClient<paths>({
  baseUrl: process.env.BACKEND_URL?.replace('/api', '') || '',
  headers: {
    'Content-Type': 'application/json',
  },
});
