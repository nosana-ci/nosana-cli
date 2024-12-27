// middleware/verifyWebSocket.ts
import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { Request } from 'express';
import { configs } from '../../../configs/configs';

export const verifyWebSocketConnection = (
  ws: WebSocket,
  req: Request,
  next: Function,
) => {
  const authHeader = req.headers['authorization'] as string;
  if (!authHeader) {
    ws.close(4001, 'Authorization header required');
    return;
  }

  const [address, base64Signature] = authHeader.split(':');
  const signature = Buffer.from(base64Signature, 'base64');
  const publicKey = new PublicKey(address);
  const message = Buffer.from(configs().signMessage);

  if (!nacl.sign.detached.verify(message, signature, publicKey.toBytes())) {
    ws.close(4002, 'Invalid signature');
    return;
  }

  (ws as any).address = address;
  next();
};
