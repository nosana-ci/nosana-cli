import type { Client } from '@nosana/sdk';

import { getSDK } from './sdk.js';
import { configs } from './NodeManager/configs/configs.js';

export const createSignature = async (): Promise<Headers> => {
  const nosana: Client = getSDK();
  const config = configs();
  const headers = await nosana.authorization.generateHeader(config.signMessage);
  return headers;
};
