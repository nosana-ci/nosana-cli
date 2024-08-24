import express, { Request, Response } from 'express';
import { config } from '../generic/config.js';
import { NosanaNode } from './NosanaNode.js';
import LogSubscriberManager, { LogEvent } from './LogSubscriberManager.js';

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

/**
 * We use this to store the user clients and job they subscribe too,
 * we only stream logs of the job they subscribe
 */
app.locals.logSatusClients = [];
app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send('jobId path parameter is required');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  app.locals.logSatusClients.push({ response: res, jobId });

  const events = logSubscriberManager
    .getEvents()
    .filter((event) => event.job === jobId);
  res.write(`data: ${JSON.stringify(events)}\n\n`);

  req.on('close', () => {
    const index = app.locals.logSatusClients.findIndex(
      (client: StatusLogClient) => client.response === res,
    );
    if (index !== -1) {
      app.locals.logSatusClients.splice(index, 1);
    }
  });
});

export const api = {
  start: async (nosanaNode: NosanaNode): Promise<number> => {
    node = nosanaNode;

    logSubscriberManager = new LogSubscriberManager();
    logSubscriberManager.subscribe((log: LogEvent) => {
      app.locals.logSatusClients.forEach((client: StatusLogClient) => {
        if (log.job === client.jobId) {
          client.response.write(`data: ${JSON.stringify([log])}\n\n`);
        }
      });
    });
    logSubscriberManager.listenToLoggerEvents(node.logger, node);

    return await new Promise<number>(async function (resolve, reject) {
      app.listen(port, () => {
        resolve(port);
      });
    });
  },
  port,
};
