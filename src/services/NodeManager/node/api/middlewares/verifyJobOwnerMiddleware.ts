import { Request, Response, NextFunction } from 'express';
import { Job, Client as SDK } from '@nosana/sdk';

export interface CustomRequest extends Request {
  address?: string;
}

export const verifyJobOwnerMiddleware = (sdk: SDK) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    const jobId = req.params.jobId;

    if (!jobId) {
      res.status(400).send('jobId path parameter is required');
      return;
    }

    try {
      const job: Job = await sdk.jobs.get(jobId);

      if (req.address !== job.project.toString()) {
        res.status(403).send('Invalid address');
        return;
      }

      next();
    } catch (error) {
      res.status(500).send('Error validating job owner');
    }
  };
};
