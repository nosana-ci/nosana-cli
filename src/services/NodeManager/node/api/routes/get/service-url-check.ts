import { Response } from 'express';
import { NodeAPIRequest } from '../../types/index.js';
import { getSDK } from '../../../../../sdk.js';
import { state } from '../../../../monitoring/state/NodeState.js';

export function getServiceUrlStatus(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  try {
    const sdk = getSDK();

    const nodeState = state(sdk.solana.provider!.wallet.publicKey.toString());

    if (!req.params.jobId) {
      res.status(400).send('No job Id specified');
      return;
    }

    if (!nodeState.shared.job || nodeState.shared.job !== req.params.jobId) {
      res.status(400).send('Job not found');
      return;
    }

    if (
      nodeState.shared &&
      nodeState.shared.serviceUrlReady &&
      nodeState.shared.serviceUrlReady == 'true'
    ) {
      res.status(200).send(true);
      return;
    } else {
      res.status(200).send(false);
      return;
    }
  } catch (error) {
    res.status(500).send('Error checking service url status');
  }
}
