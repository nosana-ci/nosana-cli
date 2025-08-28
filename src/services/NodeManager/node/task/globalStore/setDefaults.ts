import TaskManager from '../TaskManager.js';
import { configs } from '../../../configs/configs.js';
import { createHash, JobDefinition, Operation } from '@nosana/sdk';
import { generateExposeId } from '../../../../../generic/expose-util.js';
import { NodeConfigsSingleton } from '../../../configs/NodeConfigs.js';

export function setDefaults(
  this: TaskManager,
  project: string,
  jobDefinition: JobDefinition,
): void {
  const config = NodeConfigsSingleton.getInstance();
  // const {
  //   frp: { serverAddr },
  //   network,
  // } = configs();

  // TODO: Set globals
  // this.globalOpStore = {
  //   ...this.globalOpStore,
  // };

  // TODO: Add all endpoints
  for (const op of jobDefinition.ops) {
    if (op.type === 'container/run') {
      if (jobDefinition.deployment_id) {
        if ((op as Operation<'container/run'>).args.expose) {
          const opStore = (this.globalOpStore[op.id] ??= {});
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
