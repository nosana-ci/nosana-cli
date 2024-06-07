import express, { Request, Response } from 'express';

const app = express();
const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3123;
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
