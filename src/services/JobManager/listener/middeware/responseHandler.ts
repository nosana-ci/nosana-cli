import { Request, Response } from 'express';

export function handleResponse(req: Request, res: Response) {
  if (res.locals.error) {
    res.status(400).send(res.locals.error);
  }

  if (res.locals.result) {
    res.send(res.locals.result);
  }

  console.log(
    `INFO:  ${req.get('host')} - "${req.method} ${
      req.path
    } ${req.protocol.toUpperCase()}/${req.httpVersion}" ${res.statusCode}`,
  );
}
