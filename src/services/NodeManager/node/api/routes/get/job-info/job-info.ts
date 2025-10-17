import { Response } from 'express';

import { pollActiveJob } from './pollActiveJob.js';
import { JobInfoResponse } from './buildInfoObject.js';
import { NodeAPIRequest } from '../../../types/index.js';
import { createEventSource } from '../../../eventsource/index.js';

export function getJobInfoRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const jobId = req.params.jobId;

  if (!jobId) {
    return res.status(400).send('Job id parameter not provided.');
  }

  const flowState = req.repository!.getFlowState(jobId);

  if (!flowState) {
    return res.status(404).send('Failed to find job for provided job id.');
  }

  const { sendIfChanged, closeEventSource } =
    createEventSource<JobInfoResponse>(req, res);

  const { stopPolling } = pollActiveJob(
    req.repository!,
    jobId,
    sendIfChanged,
    closeEventSource,
  );

  req.on('close', stopPolling);
  req.on('error', stopPolling);
  res.on('error', stopPolling);
  res.on('finish', stopPolling);
}
