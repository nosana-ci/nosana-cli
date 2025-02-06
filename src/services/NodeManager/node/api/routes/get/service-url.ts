import { Response } from 'express';

import { NodeAPIRequest } from '../../types/index.js';
import { configs } from '../../../../configs/configs.js';
import { getSDK } from '../../../../../sdk.js';
import { state } from '../../../../monitoring/state/NodeState.js';

export function getServiceUrlRoute(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  try {
    const jobId = req.params.jobId;

    const flow = req.repository!.getflow(jobId);
    const secrets = flow?.state.secrets;

    let status = 'OFFLINE';

    const sdk = getSDK();

    const nodeState = state(sdk.solana.provider!.wallet.publicKey.toString());

    if (secrets && secrets[jobId]) {
      if (nodeState?.shared?.job === req.params.jobId) {
        status = nodeState.shared.serviceUrlReady ? 'ONLINE' : 'OFFLINE';
      } else {
        status = 'OFFLINE';
      }

      res.status(200).json({
        url: `https://${secrets[jobId]}.${configs().frp.serverAddr}`,
        status,
      });
      return;
    }

    res.status(400).send('No exposed url for job id');
  } catch (error) {
    res.status(500).send('Error occured getting url');
  }
}
