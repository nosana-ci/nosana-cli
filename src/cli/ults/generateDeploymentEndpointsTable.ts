import { Table } from 'console-table-printer';
import { JobDefinition, OperationArgsMap, ExposedPort } from '@nosana/sdk';

import { generateExposeId } from '../../generic/expose-util.js';
import { configs } from '../../services/NodeManager/configs/configs.js';

export function generateDeploymentEndpointsTable(jobDefinition: JobDefinition) {
  const table = new Table({
    title: `🚀 Deployment Endpoints 🚀`,
    defaultColumnOptions: {
      alignment: 'left',
      color: 'green',
    },
  });

  for (const op of jobDefinition.ops) {
    if (op.type === 'container/run') {
      const { expose } = op.args as OperationArgsMap['container/run'];
      if (expose) {
        if (typeof expose === 'number' || typeof expose === 'string') {
          const generatedId = generateExposeId(
            jobDefinition.deployment_id!,
            op.id,
            0,
            false,
          );
          table.addRow({
            OpId: op.id,
            Port: expose,
            Url: `https://${generatedId}.${configs().frp.serverAddr}`,
          });
        }

        if (Array.isArray(expose)) {
          expose.forEach((port) => {
            const p =
              typeof port === 'object' ? (port as ExposedPort).port : port;

            const generatedId = generateExposeId(
              jobDefinition.deployment_id!,
              op.id,
              0,
              false,
            );

            table.addRow({
              OpId: op.id,
              Port: p,
              Url: `https://${generatedId}.${configs().frp.serverAddr}`,
            });
          });
        }
      }
    }
  }

  table.printTable();
}
