import { PublicKey } from '@solana/web3.js';
import { NextFunction, Response } from 'express';

import { getSDK } from '../../../../../sdk.js';
import { NodeAPIRequest } from '../../types/index.js';
import { configs } from '../../../../configs/configs.js';

export async function verifyBackendSignatureMiddleware(
  req: NodeAPIRequest,
  res: Response,
  next: NextFunction,
) {
  const sdk = getSDK();

  try {
    if (
      !sdk.authorization.validateHeader(req.headers, {
        expiry: 300,
        key: 'x-session-id',
        publicKey: new PublicKey(configs().backendAuthorizationAddress),
      })
    ) {
      return res.status(401).send('Unauthorized Request');
    }
    res.locals['session_id'] = (req.headers['x-session-id'] as string).split(
      ':',
    )[0];

    next();
  } catch (error) {
    res.status(401).send(`Unauthorized Request: ${(error as Error).message}`);
  }
}
