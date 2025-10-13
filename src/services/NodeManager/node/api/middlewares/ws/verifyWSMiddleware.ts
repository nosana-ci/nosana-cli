import WebSocket from 'ws';

import { getSDK } from '../../../../../sdk.js';

export async function verifyWSMiddleware(
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

    nextFunction(ws, headers, body);
  } catch (error) {
    ws.close(3000, `Unauthorized Request: ${(error as Error).message}`);
  }
}
