import { NextFunction, Response } from 'express';
import { JobRequest } from '../types';

export function getJob(
  req: JobRequest<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const job = req.jobManager!.get(req.params.id);

  if (!job) {
    res.locals.error = {
      error: 'Invalid job id',
      message: `${req.params.id} not found`,
    };

    next();
  }

  res.locals.result = job;

  next();
}
