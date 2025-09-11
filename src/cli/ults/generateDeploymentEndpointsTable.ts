import { Table } from 'console-table-printer';
import { JobDefinition, OperationArgsMap } from '@nosana/sdk';

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
        const isPlaceholder = (v: unknown): v is string =>
          typeof v === 'string' && /^%%(ops|globals)\.[^%]+%%$/.test(v);
        const isSpreadMarker = (v: unknown): boolean =>
          !!v && typeof v === 'object' && !Array.isArray(v) && '__spread__' in (v as any);

        if (
          typeof expose === 'number' ||
          (typeof expose === 'string' && !isPlaceholder(expose))
        ) {
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
            if (isSpreadMarker(port)) return; // skip dynamic
            if (typeof port === 'string' && isPlaceholder(port)) return; // skip dynamic

            const p = typeof port === 'object' ? (port as any).port : port;

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
