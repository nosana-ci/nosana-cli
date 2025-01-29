import { config } from '../generic/config.js';
import { getSDK } from './sdk.js';
import { Client, Job, Run } from '@nosana/sdk';

export const createSignature = async (): Promise<Headers> => {
  const nosana: Client = getSDK();
  const headers = nosana.authorization.generateHeader(config.signMessage);
  return headers;
};
