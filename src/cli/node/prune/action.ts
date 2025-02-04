import { DB } from '../../../providers/modules/db/index.js';
import { ResourceManager } from '../../../services/NodeManager/node/resource/resourceManager.js';
import { selectContainerOrchestrationProvider } from '../../../services/NodeManager/provider/containerOrchestration/selectContainerOrchestration.js';
import { NodeRepository } from '../../../services/NodeManager/repository/NodeRepository.js';

export async function pruneResources(options: { [key: string]: any }) {
  try {
    const db = new DB(options.config).db;
    const repository = new NodeRepository(db);

    const containerOrchestration = selectContainerOrchestrationProvider(
      options.provider,
      options.podman,
      options.gpu,
    );

    const resourceManager = new ResourceManager(
      containerOrchestration,
      repository,
    );
    await resourceManager.prune();

    console.log('Finished pruning system');
  } catch (error) {
    throw new Error(`Pruning system failed: ${error}`);
  }
}
