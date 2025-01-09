import WebSocket from 'ws';
import { IncomingHttpHeaders } from 'http';
import { PublicKey } from '@solana/web3.js';

import { getSDK } from '../../../../../sdk.js';

export async function verifyWSNodeOrJobOwnerSignatureMiddleware(
  ws: WebSocket,
  headers: IncomingHttpHeaders,
  body: { jobAddress: string },
  nextFunction: (
    ws: WebSocket,
    headers: IncomingHttpHeaders,
    body: { jobAddress: string },
  ) => void,
) {
  const sdk = getSDK();
  const jobId = body.jobAddress;

  if (!jobId) {
    ws.close(401, 'Expected body to contain jobAddress.');
    return;
  }

  try {
    const job = await sdk.jobs.get(jobId);

    if (!job) {
      ws.close(400, `Could not find job with id ${jobId}`);
      return;
    }

    if (
      !sdk.authorization.validateHeader(headers, {
        publicKey: new PublicKey(job.project),
      }) &&
      !sdk.authorization.validateHeader(headers, {
        publicKey: sdk.solana.wallet.publicKey,
      })
    ) {
      return ws.close(401, 'Unathorized Request');
    }

    await nextFunction(ws, headers, body);
  } catch (error) {
    ws.close(401, `Unathorized Request: ${(error as Error).message}`);
  }
}
