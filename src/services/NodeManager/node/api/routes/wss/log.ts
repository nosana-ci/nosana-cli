import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { Job, Client as SDK } from '@nosana/sdk';

import { configs } from '../../../../configs/configs.js';
import { logStreaming } from '../../../../monitoring/streaming/LogStreamer.js';
import { getSDK } from '../../../../../sdk.js';
import { IncomingHttpHeaders } from 'http';

/**
 * this is for log streaming, this is going to be used by the basic job poster
 * just to show that clients logs, both from the node and the container
 */
export async function wssLogRoute(
  ws: WebSocket,
  _: IncomingHttpHeaders,
  { jobAddress }: { jobAddress: string },
) {
  const sdk = getSDK();
  const walletAddress = sdk.solana.wallet.toString();

  logStreaming(walletAddress).subscribe(ws, jobAddress);
}
