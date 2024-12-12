import { Response } from 'express';

import { state } from '../../../../monitoring/state/NodeState.js';
import { NodeAPIRequest } from '../../types/index.js';

export function getNodeInfoRoute(req: NodeAPIRequest<{}>, res: Response) {
  const info = req.repository!.getNodeInfo();

  res.status(200).json({
    ...state(req.address!.toString()).getNodeInfo(),
    info: {
      ...info,
      gpus: {
        ...info.gpus,
        devices: info.gpus.devices.map(
          ({ index, name, uuid, memory, network_architecture }) => ({
            index,
            name,
            uuid,
            memory,
            network_architecture,
          }),
        ),
      },
    },
  });
}
