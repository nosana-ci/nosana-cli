import { NextFunction, Response } from 'express';
import typia from 'typia';

import { JobRequest, PostRequestBody } from '../../types/index.js';

export function validateJobPostBody(
  req: JobRequest<PostRequestBody>,
  res: Response,
  next: NextFunction,
) {
  const validator = typia.createValidateEquals<PostRequestBody>();

  const isValid = validator(req.body);

  if (!isValid.success) {
    res.locals.error = {
      error: 'Failed to validate body.',
      message: isValid.errors,
    };
  }

  next();
}
