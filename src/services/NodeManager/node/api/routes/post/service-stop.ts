import { Response } from 'express';

import { NodeAPIRequest } from '../../types/index.js';

export async function postServiceStopRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const jobId = req.params.jobId;

  if (!jobId) {
    return res.status(400).send('jobId path parameter is required');
  }

  try {
    req.eventEmitter!.emit('stop-job', jobId);
    res.status(200).send('job stopped successfully');
  } catch (error) {
    res.status(500).send('Error occured while stopping job');
  }
}
