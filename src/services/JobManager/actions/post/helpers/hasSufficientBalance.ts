import { getNosBalance, getSDK, getSolBalance } from '../../../../sdk.js';

async function hasSufficentNos(): Promise<boolean> {
  const nosana = getSDK();

  const market = await nosana.jobs.getMarket(
    nosana.solana.config.market_address,
  );
  const nosNeeded = (market.jobPrice / 1e6) * market.jobTimeout;
  const nosBalance = getNosBalance();

  return (
    nosNeeded > 0 &&
    (!nosBalance || !nosBalance.uiAmount || nosBalance.uiAmount < nosNeeded)
  );
}

function hasSufficentSol(): boolean {
  const solBalance = getSolBalance();

  return solBalance < 0.05 * 1e9;
}

export async function hasSufficentBalance(): Promise<Boolean> {
  return hasSufficentSol() && (await hasSufficentNos());
}
