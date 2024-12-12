import { Response } from 'express';

import { NodeAPIRequest } from '../../types/index.js';
import { configs } from '../../../../configs/configs.js';

export function getServiceUrlRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  try {
    const jobId = req.params.jobId;

    const flow = req.repository!.getflow(jobId);
    const secrets = flow?.state.secrets;

    if (secrets && secrets[jobId]) {
      res
        .status(200)
        .send(`https://${secrets[jobId]}.${configs().frp.serverAddr}`);
      return;
    }

    res.status(400).send('No exposed url for job id');
  } catch (error) {
    res.status(500).send('Error occured getting url');
  }
}
