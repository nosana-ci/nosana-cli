import { NextFunction, Request, Response } from 'express';
import { JobRequest } from '../types';

export function listJobs(
  req: JobRequest<{}>,
  res: Response,
  next: NextFunction,
) {
  res.locals.result = req.jobManager!.list();

  next();
}
