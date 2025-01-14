import { Response } from 'express';

import { NodeAPIRequest } from '../../types/index.js';

export function getJobDefinitionRoute(
  req: NodeAPIRequest<{ id: string }>,
  res: Response,
) {
  const id = req.params.id;

  if (!id) {
    return res.status(400).send('job id parameter not provided');
  }

  const flowState = req.repository!.getFlowState(id);

  if (!flowState) {
    return res.status(400).send('invalid job id');
  }

  if (flowState.status !== 'waiting-for-result') {
    return res.status(400).send('cannot get job result at this time');
  }

  req.eventEmitter!.emit('job-result', { id });

  res.status(200).send(JSON.stringify(flowState));
}
