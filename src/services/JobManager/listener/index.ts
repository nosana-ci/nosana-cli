import express, { Response, NextFunction } from 'express';
import cors from 'cors';

import JobManager from '../index.js';
import { handleResponse } from './middeware/responseHandler.js';
import { validateJobPostBody } from './middeware/validators/index.js';
import { getJob } from './routes/get.js';
import { listJobs } from './routes/list.js';
import { postJob } from './routes/post.js';
import { jobStatus } from './routes/status.js';
import { stopJob } from './routes/stop.js';
import { JobRequest } from './types/index.js';

export const jobListener = (port: number, jobManager: JobManager) => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use((req: JobRequest, _: Response, next: NextFunction) => {
    req.jobManager = jobManager;
    next();
  });

  // GET Routes
  app.get('/jobs', listJobs);
  app.get('/job/:id', getJob);
  app.get('/status/:id', getJob, jobStatus);

  // POST Routes
  app.post('/job/post', validateJobPostBody, postJob);
  app.post('/job/stop/"id', stopJob);

  // Put Routes (update replicas)

  app.use(handleResponse);

  app.listen(port, () => console.log(`Listening on port ${port}`));
};
