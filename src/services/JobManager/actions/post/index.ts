import { PublicKey } from '@solana/web3.js';

import {
  JobDefinition,
  validateJobDefinition,
} from '../../../../providers/Provider.js';
import { config } from '../../../../generic/config.js';
import { getSDK } from '../../../sdk.js';
import { isExposedJobOps } from '../utils/isExposedJob.js';
import { hasSufficientBalance } from './helpers/hasSufficientBalance.js';

export type PostJobResult = {
  job: string;
  tx: string;
  job_timeout: number;
  created_at: string;
  service_url: string | undefined;
};

export function postJob(
  marketAddress: string,
  job: JobDefinition,
  // TODO: ADD FORMATTER SUPPORT
): Promise<PostJobResult> {
  return new Promise(async (resolve, reject) => {
    const nosana = getSDK();
    // TODO: Support market slugs
    try {
      if (new PublicKey(marketAddress)) {
        nosana.solana.config.market_address = marketAddress;
      }
    } catch (_) {
      return reject('Invalid market address');
    }

    if (!hasSufficientBalance()) {
      return reject('Insufficient balance');
    }

    const validation = validateJobDefinition(job);

    if (!validation.success) {
      return reject('Failed to validate job definition');
    }

    const market = await nosana.jobs.getMarket(
      nosana.solana.config.market_address,
    );

    const ipfsHash = await nosana.ipfs.pin(job);

    await nosana.jobs.setAccounts();

    if (market.jobPrice == 0) {
      nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
    }

    try {
      const response = await nosana.jobs.list(ipfsHash);
      resolve({
        job: response.job,
        tx: response.tx,
        job_timeout: 1 * market.jobTimeout,
        service_url: isExposedJobOps(job)
          ? `https://${response.job}.${config.frp.serverAddr}`
          : undefined,
        created_at: new Date().toString(),
      });
    } catch (e) {
      reject((e as Error).message);
    }
  });
}
