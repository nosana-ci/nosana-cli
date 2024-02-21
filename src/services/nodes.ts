import { Client, Market, Run } from '@nosana/sdk';
import { getSDK } from './sdk.js';
import { ClientSubscriptionId, PublicKey, TokenAmount } from '@solana/web3.js';
import { setIntervalImmediately } from '../generic/utils.js';
import { NotQueuedError } from '../generic/errors.js';

export type NodeStats = {
  sol: number;
  nos: TokenAmount | undefined;
  stake: number;
  nfts: Array<PublicKey>;
};

export const getNodeStats = async (
  node: PublicKey | string,
): Promise<NodeStats> => {
  const nosana: Client = getSDK();

  const solBalance = await nosana.solana.getSolBalance(node);
  const nosBalance = await nosana.solana.getNosBalance(node);

  return {
    sol: solBalance,
    nos: nosBalance,
    stake: 0,
    nfts: [],
  };
};

export const getRun = async (node: string): Promise<Run | void> => {
  const nosana: Client = getSDK();
  const runs = await nosana.jobs.getRuns([
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    },
  ]);
  if (runs && runs.length > 0) {
    return runs[0];
  }
};

export const waitForRun = async (
  node: string,
  enableQueueCheck: boolean = false,
): Promise<Run> => {
  const nosana: Client = getSDK();
  await nosana.jobs.loadNosanaJobs();
  const jobProgram = nosana.jobs.jobs!;
  const runAccountFilter: { offset: number; bytes: string } =
    jobProgram.coder.accounts.memcmp(
      jobProgram.account.runAccount.idlAccount.name,
      undefined,
    );
  const coderFilters = [
    {
      memcmp: {
        offset: runAccountFilter.offset,
        bytes: runAccountFilter.bytes,
      },
    },
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    },
  ];
  let subscriptionId: ClientSubscriptionId;
  let getRunsInterval: NodeJS.Timer;
  let checkQueuedInterval: NodeJS.Timer;
  return new Promise<Run>(function (resolve, reject) {
    if (enableQueueCheck) {
      // check if we are still queued in a market every 2 minutes
      checkQueuedInterval = setIntervalImmediately(async () => {
        const selectedMarket = await checkQueued(node);
        if (!selectedMarket) {
          reject(new NotQueuedError('Node not queued anymore'));
        }
      }, 60000 * 2);
    }

    // As a fallback for the run events, runs every 5 minutes
    getRunsInterval = setInterval(async () => {
      const run: Run | void = await getRun(node);
      if (run) resolve(run);
    }, 60000 * 5);
    subscriptionId = nosana.jobs.connection!.onProgramAccountChange(
      jobProgram.programId,
      async (event) => {
        const runAccount = jobProgram.coder.accounts.decode(
          jobProgram.account.runAccount.idlAccount.name,
          event.accountInfo.data,
        );
        const run: Run = {
          account: runAccount,
          publicKey: event.accountId,
        };
        resolve(run);
      },
      'confirmed',
      coderFilters,
    );
  }).then((run) => {
    if (typeof subscriptionId !== 'undefined')
      nosana.jobs.connection!.removeProgramAccountChangeListener(
        subscriptionId,
      );
    if (getRunsInterval) clearInterval(getRunsInterval);
    if (checkQueuedInterval) clearInterval(checkQueuedInterval);
    return run;
  });
};

export const checkQueued = async (node: string): Promise<Market | void> => {
  const nosana: Client = getSDK();
  const markets = await nosana.jobs.allMarkets();
  // check all markets and see if the node is in the queue
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    if (
      market &&
      market.queue &&
      market.queue.find((e: PublicKey) => e.toString() === node)
    ) {
      return market;
    }
  }
};
