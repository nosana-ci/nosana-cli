import { Response } from 'express';

import { state } from '../../../../../monitoring/state/NodeState';
import { NodeAPIRequest } from '../../../types';

export function nodeInfoRoute(req: NodeAPIRequest<{}>, res: Response) {
  res.status(200).json({
    ...state(req.address!.toString()).getNodeInfo(),
    info: req.repository!.getNodeInfo(),
  });
}
