import { Table } from 'console-table-printer';
import { JobDefinition, OperationArgsMap } from '@nosana/sdk';

import { generateExposeId } from '../../generic/expose-util.js';
import { configs } from '../../services/NodeManager/configs/configs.js';

export function generateDeploymentEndpointsTable(jobDefinition: JobDefinition) {
  jobDefinition.ops.forEach((op, index) => {
    if (op.type === 'container/run') {
      const { expose } = op.args as OperationArgsMap['container/run'];
      if (expose) {
        const table = new Table({
          title: `🚀 Deployment Endpoints 🚀`,
          defaultColumnOptions: {
            alignment: 'left',
            color: 'green',
          },
        });

        if (typeof expose === 'number') {
          const generatedId = generateExposeId(
            jobDefinition.deployment_id!,
            index,
            expose,
            (op.args as OperationArgsMap['container/run']).private,
          );
          table.addRow({
            OpIndex: index,
            OpId: op.id,
            Port: expose,
            Url: `https://${generatedId}.${configs().frp.serverAddr}`,
          });
        }

        if (Array.isArray(expose)) {
          expose.forEach((port) => {
            let p = typeof port === 'number' ? port : port.port;

            const generatedId = generateExposeId(
              jobDefinition.deployment_id!,
              index,
              p,
              (op.args as OperationArgsMap['container/run']).private,
            );

            table.addRow({
              OpIndex: index,
              OpId: op.id,
              Port: p,
              Url: `https://${generatedId}.${configs().frp.serverAddr}`,
            });
          });
        }

        table.printTable();
      }
    }
  });
}
