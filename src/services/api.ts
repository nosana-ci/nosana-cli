import express, { Request, Response, NextFunction } from 'express';
import { config } from '../generic/config.js';
import { NosanaNode } from './NosanaNode.js';
import LogSubscriberManager from './LogSubscriberManager.js';
import nacl from 'tweetnacl';
import { getSDK } from './sdk.js';
import { Client, Job, Run } from '@nosana/sdk';
import * as web3 from '@solana/web3.js';

export interface CustomRequest extends Request {
  address?: string;
}

export interface SignatureHeaders {
  Authorization: string;
}

const app = express();
const port = config.api.port;

let node: NosanaNode;
let logSubscriberManager: LogSubscriberManager;

export const createSignature = async (): Promise<SignatureHeaders> => {
  const nosana: Client = getSDK();
  const signature = (await nosana.solana.signMessage(
    config.signMessage,
  )) as Uint8Array;
  const base64Signature = Buffer.from(signature).toString('base64');

  const headers: SignatureHeaders = {
    Authorization: `${nosana.solana.wallet.publicKey.toString()}:${base64Signature}`,
  };

  return headers;
};

const verifySignatureMiddleware = (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization'] as string;

  if (!authHeader) {
    res.status(401).send('Authorization header is required');
    return;
  }

  const [address, base64Signature] = authHeader.split(':');

  if (!address || !base64Signature) {
    res.status(400).send('Invalid Authorization format');
    return;
  }

  const signature = Buffer.from(base64Signature, 'base64');
  const message = Buffer.from(config.signMessage);
  const publicKey = new web3.PublicKey(address);

  const isValidSignature = nacl.sign.detached.verify(
    message,
    signature,
    publicKey.toBytes(),
  );

  if (!isValidSignature) {
    res.status(403).send('Invalid signature');
    return;
  }

  req.address = address;

  next();
};

const verifyJobOwnerMiddleware = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send('jobId path parameter is required');
    return;
  }

  const job: Job = await node.sdk.jobs.get(jobId)

  if (req.address !== job.project.toString()) {
    res.status(403).send('Invalid address');
    return;
  }
  next();
};

app.get('/', (req: Request, res: Response) => {
  res.send(node.address);
});

app.get(
  '/status/:jobId',
  verifySignatureMiddleware,
  verifyJobOwnerMiddleware,
  (req: Request, res: Response) => {
    const jobId = req.params.jobId;

    if (!jobId) {
      res.status(400).send('jobId path parameter is required');
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    logSubscriberManager.addClient(res, jobId);
  },
);

export const api = {
  start: async (nosanaNode: NosanaNode): Promise<number> => {
    node = nosanaNode;

    logSubscriberManager = new LogSubscriberManager();
    logSubscriberManager.listenToLoggerEvents(node.logger, node);

    return await new Promise<number>((resolve, reject) => {
      app.listen(port, () => {
        resolve(port);
      });
    });
  },
  port,
};
