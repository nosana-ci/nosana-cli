import { Request } from 'express';

import { JobDefinition } from '../../../../providers/Provider.js';
import JobManager from '../../index.js';

export type JobRequest<Params = {}, Body = {}> = Request<Params, {}, Body> & {
  jobManager?: JobManager;
};

export type PostRequestBody = {
  market: string;
  job: JobDefinition;
  recursive?: boolean;
  replicas?: {
    count: number;
    health_prob?: string;
  };
  group_id?: string;
};