import { Response } from 'express';

import { NodeAPIRequest } from '../../types/index.js';
import { TaskManagerRegistry } from '../../../task/TaskManagerRegistry.js';

export function getJobDefinitionRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const id = req.params.jobId;

  if (!id) {
    return res.status(400).send('job id parameter not provided');
  }

  const flowState = req.repository!.getFlow(id);

  if (!flowState) {
    return res.status(400).send('invalid job id');
  }

  if (flowState.state.status === 'waiting-for-job-definition') {
    return res
      .status(400)
      .send(
        'The job definition has not yet been set. Please set the job definition and try again.',
      );
  }

  res.status(200).send(JSON.stringify(flowState.jobDefinition));
}
