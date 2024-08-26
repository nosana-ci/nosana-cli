import express, { Request, Response } from 'express';
import { config } from '../generic/config.js';
import { NosanaNode } from './NosanaNode.js';
import LogSubscriberManager from './LogSubscriberManager.js';

type StatusLogClient = {
  response: Response;
  jobId: string;
};

const app = express();
const port = config.api.port;

let node: NosanaNode;
let logSubscriberManager: LogSubscriberManager;

app.get('/', (req: Request, res: Response) => {
  res.send(node.address);
});

app.get('/status/:jobId', (req: Request, res: Response) => {
  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send('jobId path parameter is required');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  logSubscriberManager.addClient(res, jobId);
});

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