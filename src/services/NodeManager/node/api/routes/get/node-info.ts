import { Response } from 'express';

import { state } from '../../../../monitoring/state/NodeState.js';
import { NodeAPIRequest } from '../../types/index.js';

export function getNodeInfoRoute(req: NodeAPIRequest<{}>, res: Response) {
  res.status(200).json({
    ...state(req.address!.toString()).getNodeInfo(),
    info: req.repository!.getNodeInfo(),
  });
}
