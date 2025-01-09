import { Response } from 'express';

import { JobDefinition } from '../../../../provider/types.js';
import { NodeAPIRequest } from '../../types/index.js';

export function postJobDefinitionRoute(
  req: NodeAPIRequest<{ jobId: string }, { jobDefinition: JobDefinition }>,
  res: Response,
) {
  const id = req.params.jobId;
  const jobDefinition = req.body.jobDefinition;
  if (!jobDefinition || !id) {
    return res.status(400).send('job definition parameters not provided');
  }

  if (!req.repository!.getFlowState(id)) {
    return res.status(400).send('invalid job id');
  }

  if (
    req.repository!.getFlowState(id).status !== 'waiting-for-job-defination'
  ) {
    return res.status(400).send('cannot send job defination at this time');
  }

  req.eventEmitter!.emit('job-definition', { jobDefinition, id });
  res.status(200).send('Job definition received');
}
