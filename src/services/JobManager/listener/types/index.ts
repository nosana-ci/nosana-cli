import { Request } from 'express';

import { JobDefinition } from '../../../../providers/Provider.js';
import JobManager from '../../index.js';

export type JobRequest<Params = {}, Body = {}> = Request<Params, {}, Body> & {
  jobManager?: JobManager;
};

export type JobPostingOptions = {
  recursive?: boolean;
  replica_count?: number;
  replica_offset?: number;
  health_prob?: string;
};

export type PostRequestBody = {
  market: string;
  job: JobDefinition;
  options: JobPostingOptions;
};
