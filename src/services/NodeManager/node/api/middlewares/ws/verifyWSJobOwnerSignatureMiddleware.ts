import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';

import { getSDK } from '../../../../../sdk.js';

export async function verifyWSJobOwnerSignatureMiddleware(
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
    ws.close(1007, 'Expected body to contain jobAddress.');
    return;
  }

  try {
    const job = await sdk.jobs.get(jobId);

    if (!job) {
      ws.close(1007, `Could not find job with id ${jobId}`);
      return;
    }

    try {
      if (
        sdk.authorization.validate(headers, {
          publicKey: new PublicKey(job.project),
        })
      ) {
        await nextFunction(ws, headers, body);
      }
    } catch (_) {
      ws.close(3000, 'Unathorized Request');
    }
  } catch (error) {
    ws.close(3000, `Unathorized Request: ${(error as Error).message}`);
  }
}
