import { Response, NextFunction } from 'express';
import { JobRequest } from '../types';

export function stopJob(
  req: JobRequest<{ id: string }, {}>,
  res: Response,
  next: NextFunction,
) {
  const stopJobResult = req.jobManager!.stop(req.params.id);

  if (typeof stopJobResult !== 'string') {
    res.locals.error = {
      error: 'Failed to stop job.',
      message: stopJobResult.message,
    };

    return next();
  }

  res.locals.result = {
    id: req.params.id,
  };

  next();
}
