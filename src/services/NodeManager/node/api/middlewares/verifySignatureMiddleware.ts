import { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { config } from "../../../../../generic/config.js";

export const verifySignatureMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] as string;
    if (!authHeader) return res.status(401).send('Authorization header is required');

    const [address, base64Signature] = authHeader.split(':');
    if (!address || !base64Signature) return res.status(400).send('Invalid Authorization format');

    const signature = Buffer.from(base64Signature, 'base64');
    const message = Buffer.from(config.signMessage);
    const publicKey = new PublicKey(address);

    const isValidSignature = nacl.sign.detached.verify(message, signature, publicKey.toBytes());
    if (!isValidSignature) return res.status(403).send('Invalid signature');

    (req as any).address = address;
    next();
};
