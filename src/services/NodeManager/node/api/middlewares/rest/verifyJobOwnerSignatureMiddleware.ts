import { PublicKey } from '@solana/web3.js';
import { NextFunction, Response } from 'express';

import { getSDK } from '../../../../../sdk.js';
import { NodeAPIRequest } from '../../types/index.js';

export async function verifyJobOwnerSignatureMiddleware(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
  next: NextFunction,
) {
  const sdk = getSDK();
  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send('Expected jobId parameter.');
    return;
  }

  try {
    const job = await sdk.jobs.get(jobId);

    if (!job) {
      res.status(400).send(`Could not find job with id ${jobId}`);
      return;
    }

    if (
      !sdk.authorization.validateHeader(req.headers, {
        key: 'authorization',
        expiry: job.timeout,
        publicKey: new PublicKey(job.project),
      })
    ) {
      return res.status(401).send('Unathorized Request');
    }

    next();
  } catch (error) {
    res.status(401).send(`Unathorized Request: ${(error as Error).message}`);
  }
}
