import { Request } from 'express';

import { JobDefinition } from '../../../../providers/Provider.js';
import JobManager from '../../index.js';

export type JobRequest<Params = {}, Body = {}> = Request<Params, {}, Body> & {
  jobManager?: JobManager;
};

export type JobPostingOptions = {
  group_id?: string;
  health_prob?: string;
  recursive?: boolean;
  replica_count?: number;
  replica_offset?: number;
};

export type PostRequestBody = {
  market: string;
  job: JobDefinition;
  options: JobPostingOptions;
};
