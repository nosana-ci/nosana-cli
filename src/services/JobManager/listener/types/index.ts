import { Request, Response } from 'express';

import { JobDefinition } from '../../../../providers/Provider.js';
import JobManager from '../../index.js';

export type JobRequest<Params = {}, Body = {}> = Request<Params, {}, Body> & {
  jobManager?: JobManager;
};

export type JobResult = {
  job: string;
  tx: string;
  ipfs_hash: string;
  job_timeout: number;
  created_at: string;
  ended_at?: string;
  service_url?: string | undefined;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED';
};

export type JobObject = {
  id: string;
  recursive: boolean;
  created_at: string;
  active_nodes: JobResult[];
  expired_nodes: JobResult[];
};

export type JobResponse<Locals = {}> = Response<
  {},
  {
    result: {} | undefined;
    error: {
      error: string;
      message: string;
    };
  } & Locals
>;

export type JobPostingOptions = {
  group_id?: string;
  health_prob?: string;
  recursive?: boolean;
  recursive_offset_min?: number;
  replica_count?: number;
  replica_offset?: number;
};

export type PostRequestBody = {
  market: string;
  job: JobDefinition;
  options: JobPostingOptions;
};
