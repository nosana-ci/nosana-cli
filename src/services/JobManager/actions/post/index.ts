import {
  JobDefinition,
  validateJobDefinition,
} from '../../../../providers/Provider.js';
import { config } from '../../../../generic/config.js';
import { getSDK } from '../../../sdk.js';
import { isExposedJobOps } from '../utils/isExposedJob.js';
import { hasSufficentBalance } from './helpers/hasSufficientBalance.js';
import { PublicKey } from '@solana/web3.js';

export type PostJobResult = {
  job: string;
  tx: string;
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

    if (!hasSufficentBalance()) {
      return reject('Insufficient balance');
    }

    const validation = validateJobDefinition(job);

    if (!validation.success) {
      return reject('Failed to validate job definiton');
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
        service_url: isExposedJobOps(job)
          ? `https://${response.job}.${config.frp.serverAddr}`
          : undefined,
      });
    } catch (e) {
      reject((e as Error).message);
    }
  });
}
