import { Market } from '@nosana/sdk';

import { getSDK } from '../../../sdk.js';

// TODO: Support slug
export async function getMarket(id: string): Promise<Market> {
  const nosana = getSDK();

  try {
    const market = await nosana.jobs.getMarket(id);
    return market;
  } catch (e) {
    throw new Error(`Failed to fetch market.\n${e}`);
  }
}
