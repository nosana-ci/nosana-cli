import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { NextFunction, Response } from 'express';

import { NodeAPIRequest } from '../types/index.js';

export function verifyBackendSignatureMiddleware(
  req: NodeAPIRequest,
  res: Response,
  next: NextFunction,
) {
  const signatureHeader =
    (req.headers['X-Session-ID'] as string | undefined) ||
    (req.headers['x-session-id'] as string | undefined);

  if (!signatureHeader) {
    return res.status(401).send('Unauthorized Request: Missing session id.');
  }

  try {
    const [date, message, signatureB64] = signatureHeader.split(':');

    if (!date || !message || !signatureB64) {
      return res.status(401).send('Unauthorized Request: Invalid header.');
    }

    if ((new Date().getTime() - new Date(date).getTime()) / 60000 >= 5) {
      return res.status(401).send('Unauthorized Request: Session expired.');
    }

    const signature = Buffer.from(signatureB64, 'base64');

    const isValidSignature = nacl.sign.detached.verify(
      Buffer.from(message),
      signature,
      new PublicKey('BACKEND_KEY_COMING_SOON').toBytes(),
    );

    if (!isValidSignature) {
      return res.status(401).send('Unauthorized Request: Invalid signature');
    }

    req.signature = signatureB64;
    next();
  } catch {
    res.status(500).send('Something went wrong whilst validating request.');
  }
}
