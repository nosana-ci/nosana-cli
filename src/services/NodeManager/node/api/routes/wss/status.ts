import WebSocket from 'ws';
import { IncomingHttpHeaders } from 'http';

import { getSDK } from '../../../../../sdk.js';
import { stateStreaming } from '../../../../monitoring/streaming/StateStreamer.js';

/**
 * this is to handle state streaming, this would be used for external
 * sevices to follow a job or node state
 */
export async function wssStatusRoute(
  ws: WebSocket,
  _: IncomingHttpHeaders,
  { jobAddress }: { jobAddress: string },
) {
  const sdk = getSDK();
  const walletAddress = sdk.solana.wallet.publicKey;

  stateStreaming(walletAddress.toString()).subscribe(ws, jobAddress);
}
