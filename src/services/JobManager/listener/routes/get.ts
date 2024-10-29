import { NextFunction } from 'express';

import { JobObject, JobRequest, JobResponse } from '../types';

export function getJob(
  req: JobRequest<{ id: string }>,
  res: JobResponse<{ job: JobObject | undefined }>,
  next: NextFunction,
) {
  const jobId = req.params.id;

  if (!jobId || jobId === '') {
    res.locals.error = {
      error: 'Failed to fetch job status',
      message: 'Invalid job id.',
    };

    return next();
  }

  const job = req.jobManager!.get(req.params.id);

  if (!job) {
    res.locals.error = {
      error: 'Invalid job id',
      message: `${req.params.id} not found`,
    };

    return next();
  }

  res.locals.job = job;
  res.locals.result = job;

  next();
}
