import {
  createHash,
  JobDefinition,
  Operation,
  isOperator,
  isSpreadMarker,
  ExposedPort,
} from '@nosana/sdk';

import TaskManager from '../TaskManager.js';
import { configs } from '../../../configs/configs.js';
import { NodeConfigsSingleton } from '../../../configs/NodeConfigs.js';
import { generateExposeId } from '../../../../../generic/expose-util.js';

export function setDefaults(
  this: TaskManager,
  flowId: string,
  project: string,
  jobDefinition: JobDefinition,
): void {
  processOperationsForEndpoints.call(
    this,
    flowId,
    project,
    jobDefinition,
    jobDefinition.ops,
  );
}

export function rehydrateEndpointsForOperation(
  this: TaskManager,
  flowId: string,
  project: string,
  jobDefinition: JobDefinition,
  opId: string,
): void {
  const op = jobDefinition.ops.find((o) => o.id === opId);
  if (!op) return;

  processOperationsForEndpoints.call(this, flowId, project, jobDefinition, [
    op,
  ]);
}

function processOperationsForEndpoints(
  this: TaskManager,
  flowId: string,
  project: string,
  jobDefinition: JobDefinition,
  ops: JobDefinition['ops'],
): void {
  const config = NodeConfigsSingleton.getInstance();

  for (const op of ops) {
    const index = jobDefinition.ops.findIndex((o) => o.id === op.id);
    if (op.type === 'container/run') {
      const { args } = op as Operation<'container/run'>;
      if (args.expose) {
        const opStore = (this.globalOpStore[op.id] ??= {});

        if (!opStore.endpoint) {
          opStore.endpoint = {} as Record<string, string>;
        }

        if (Array.isArray(args.expose)) {
          for (const exposedPort of args.expose) {
            if (isSpreadMarker(exposedPort)) continue; // skip dynamic
            if (typeof exposedPort === 'string' && isOperator(exposedPort))
              continue;

            const p =
              typeof exposedPort === 'object'
                ? (exposedPort as ExposedPort).port
                : exposedPort;
            (opStore.endpoint as Record<string, string>)[
              `${p}`
            ] = `${generateExposeId(flowId, index, p, args.private)}.${
              configs().frp.serverAddr
            }`;
          }
        } else {
          if (
            !isSpreadMarker(args.expose) &&
            !(typeof args.expose === 'string' && isOperator(args.expose))
          ) {
            opStore.endpoint[`${args.expose}`] = `${generateExposeId(
              flowId,
              index,
              args.expose as string | number,
              args.private,
            )}.${configs().frp.serverAddr}`;
          }
        }

        if (jobDefinition.deployment_id) {
          opStore.deployment_endpoint = `${generateExposeId(
            // @ts-ignore
            config.options.isNodeRun
              ? jobDefinition.deployment_id
              : createHash(`${jobDefinition.deployment_id}:${project}`, 45),
            op.id,
            0,
            false,
          )}.${configs().frp.serverAddr}`;
        }
      }
    }
  }
}
