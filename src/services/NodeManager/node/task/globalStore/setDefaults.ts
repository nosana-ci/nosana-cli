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
  if (jobDefinition.global?.variables) {
    this.globalOpStore.variables = {
      ...this.globalOpStore.variables,
      ...jobDefinition.global.variables,
    };
    this.globalStore.variables = {
      ...this.globalStore.variables,
      ...jobDefinition.global.variables,
    };
  }

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

        const ports = getExposePorts(op as Operation<'container/run'>);
        for (const exposedPort of ports) {
          const p = (exposedPort as ExposedPort).port;
          const exposeId = generateExposeId(flowId, index, p, args.private);
          const url = `${exposeId}.${configs().frp.serverAddr}`;
          (opStore.endpoint as Record<string, string>)[`${p}`] = url;
          try {
            this.repository.updateOpState(this.job, index, {
              endpoints: {
                ...(this.repository.getOpState(this.job, index).endpoints ||
                  {}),
                [exposeId]: {
                  opId: op.id,
                  url,
                  port: p,
                  status: 'UNKNOWN',
                },
              },
            });
          } catch {}
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
