import express, { Request, Response } from 'express';
import { config } from '../generic/config.js';
import { NosanaNode } from './NosanaNode.js';

const app = express();
const port = config.api.port;
let node: NosanaNode;
app.get('/', (req: Request, res: Response) => {
  res.send(node.address);
});

export const api = {
  start: async (nosanaNode: NosanaNode): Promise<number> => {
    node = nosanaNode;
    return await new Promise<number>(async function (resolve, reject) {
      app.listen(port, () => {
        resolve(port);
      });
    });
  },
  port,
};
