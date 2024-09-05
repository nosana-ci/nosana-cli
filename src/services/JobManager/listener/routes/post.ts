import { NextFunction, Response } from 'express';

import { JobRequest, PostRequestBody } from '../types';

export async function postJob(
  req: JobRequest<{}, PostRequestBody>,
  res: Response,
  next: NextFunction,
) {
  if (res.locals.error) {
    return next();
  }

  try {
    const jobResult = await req.jobManager!.post(
      req.body.market.trim(),
      req.body.job,
    );
    res.locals.result = jobResult;
  } catch (e) {
    res.locals.error = {
      error: 'Failed to post job',
      message: e,
    };
  }

  next();
}
