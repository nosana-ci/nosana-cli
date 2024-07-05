import express, { Request, Response } from 'express';
import { config } from '../generic/config.js';

const app = express();
const port = config.api.port;
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

export const api = {
  start: async (): Promise<number> => {
    return await new Promise<number>(async function (resolve, reject) {
      app.listen(port, () => {
        resolve(port);
      });
    });
  },
  port,
};
