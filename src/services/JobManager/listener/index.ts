import express, { Response, NextFunction } from 'express';

import JobManager from '../index.js';
import { postJob } from './routes/post.js';
import { JobRequest } from './types/index.js';
import { handleResponse } from './middeware/responseHandler.js';
import { validateJobPostBody } from './middeware/validators/index.js';
import { getJob } from './routes/get.js';
import { listJobs } from './routes/list.js';

export const jobListener = (port: number, jobManager: JobManager) => {
  const app = express();

  app.use(express.json());
  app.use((req: JobRequest, _: Response, next: NextFunction) => {
    req.jobManager = jobManager;
    next();
  });

  // GET Routes
  app.get('/jobs', listJobs);
  app.get('/job/:id', getJob);

  // POST Routes
  app.post('/job/post', validateJobPostBody, postJob);

  // Put Routes (update replicas)

  app.use(handleResponse);

  app.listen(port, () => console.log(`Listening on port ${port}`));
};
