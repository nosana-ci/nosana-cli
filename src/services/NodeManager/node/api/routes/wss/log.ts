import WebSocket from 'ws';

import { logStreaming } from '../../../../monitoring/streaming/LogStreamer.js';
import { getSDK } from '../../../../../sdk.js';

/**
 * this is for log streaming, this is going to be used by the basic job poster
 * just to show that clients logs, both from the node and the container
 */
export async function wssLogRoute(
  ws: WebSocket,
  _: string,
  { jobAddress }: { jobAddress: string },
) {
  const sdk = getSDK();
  const walletAddress = sdk.solana.wallet.toString();

  logStreaming(walletAddress).subscribe(ws, jobAddress);
}
