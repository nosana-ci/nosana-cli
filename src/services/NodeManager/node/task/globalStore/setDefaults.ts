import { createHash, JobDefinition, Operation } from '@nosana/sdk';

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
  const config = NodeConfigsSingleton.getInstance();

  for (const [index, op] of jobDefinition.ops.entries()) {
    if (op.type === 'container/run') {
      const { args } = op as Operation<'container/run'>;
      if (args.expose) {
        const opStore = (this.globalOpStore[op.id] ??= {});

        if (!opStore.endpoint) {
          opStore.endpoint = {} as Record<string, string>;
        }

        if (Array.isArray(args.expose)) {
          for (const exposedPort of args.expose) {
            (opStore.endpoint as Record<string, string>)[
              `${
                typeof exposedPort === 'object' ? exposedPort.port : exposedPort
              }`
            ] = `${generateExposeId(
              flowId,
              index,
              typeof exposedPort === 'object' ? exposedPort.port : exposedPort,
              args.private,
            )}.${configs().frp.serverAddr}`;
          }
        } else {
          opStore.endpoint[`${args.expose}`] = `${generateExposeId(
            flowId,
            index,
            args.expose,
            args.private,
          )}.${configs().frp.serverAddr}`;
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
