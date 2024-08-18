import ora from 'ora';

import { DockerExtended } from '../../../docker/index.js';
import { DB } from '../../../providers/modules/db/index.js';
import { createSeverObject } from '../../../providers/utils/createServerObject.js';
import { createResourceManager } from '../../../providers/modules/resourceManager/index.js';
import Logger from '../../../providers/modules/logger/index.js';

type PruneResourcesOption = {
  podman: string;
  config: string;
};

export async function pruneResources({ config, podman }: PruneResourcesOption) {
  const db = new DB(config).db;
  const docker = new DockerExtended({
    ...createSeverObject(podman),
  });
  const logger = new Logger();

  const { prune } = createResourceManager(db, docker, logger);

  logger.log('Pruning system', true);

  await prune();

  logger.succeed('Finished pruning system');
}
