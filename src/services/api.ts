import { config } from '../generic/config.js';
import { getSDK } from './sdk.js';
import { Client } from '@nosana/sdk';

export const createSignature = async (): Promise<Headers> => {
  const nosana: Client = getSDK();
  const headers = await nosana.authorization.generateHeader(config.signMessage);
  return headers;
};
