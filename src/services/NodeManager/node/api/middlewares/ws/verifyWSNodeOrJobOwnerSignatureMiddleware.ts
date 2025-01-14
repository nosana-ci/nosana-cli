import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';

import { getSDK } from '../../../../../sdk.js';

export async function verifyWSNodeOrJobOwnerSignatureMiddleware(
  ws: WebSocket,
  headers: string,
  body: { jobAddress: string },
  nextFunction: (
    ws: WebSocket,
    headers: string,
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

    try {
      if (
        sdk.authorization.validate(headers, {
          publicKey: new PublicKey(job.project),
        }) ||
        sdk.authorization.validate(headers, {
          publicKey: sdk.solana.wallet.publicKey,
        })
      ) {
        await nextFunction(ws, headers, body);
      }
    } catch (_) {
      ws.close(401, 'Unathorized Request');
    }
  } catch (error) {
    ws.close(401, `Unathorized Request: ${(error as Error).message}`);
  }
}
