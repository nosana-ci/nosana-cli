import { Response, NextFunction } from 'express';
import type { JobRequest } from '../types';

export async function stopJob(
  req: JobRequest<{ id: string }, {}>,
  res: Response,
  next: NextFunction,
) {
  const stopJobResult = await req.jobManager!.stop(req.params.id);

  if (stopJobResult.length > 0) {
    res.locals.error = {
      error: 'Failed to stop job.',
      message: `Cannot not stop queued jobs: ${stopJobResult.join(', ')}`,
    };

    return next();
  }

  res.locals.result = {
    id: req.params.id,
  };

  next();
}
