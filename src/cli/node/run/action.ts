import fs from 'node:fs';
import util from 'util';
import {
  FlowState,
  JobDefinition,
  validateJobDefinition,
} from '../../../services/NodeManager/provider/types.js';
import { Provider } from '../../../services/NodeManager/provider/Provider.js';
import { ResourceManager } from '../../../services/NodeManager/node/resource/resourceManager.js';
import { NodeRepository } from '../../../services/NodeManager/repository/NodeRepository.js';
import { DB } from '../../../providers/modules/db/index.js';
import { selectContainerOrchestrationProvider } from '../../../services/NodeManager/provider/containerOrchestration/selectContainerOrchestration.js';
import { FlowHandler } from '../../../services/NodeManager/node/flow/flowHandler.js';
import { IValidation } from 'typia';
import { createLoggingProxy } from '../../../services/NodeManager/monitoring/proxy/loggingProxy.js';
import { log } from '../../../services/NodeManager/monitoring/log/NodeLog.js';
import {
  ConsoleLogger,
  consoleLogging,
} from '../../../services/NodeManager/monitoring/log/console/ConsoleLogger.js';

// This is still a WIP: i will still have to expose the logs and progress logs
export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: any;
  },
) {
  try {
    const jobDefinition: JobDefinition = await resolveJobDefination(
      options,
      jobDefinitionFile,
    );

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

    const provider = new Provider(
      containerOrchestration,
      repository,
      resourceManager,
    );

    const flowHandler = createLoggingProxy(
      new FlowHandler(provider, repository),
    );

    /**
     * set up log listening, any instance can listen to log produces from the node
     * the logs are produces from the log proxy
     */
    log();

    const logger = new ConsoleLogger(false);
    logger.addObserver();

    const id = flowHandler.generateRandomId(32);

    const exitHandler = async () => {
      await flowHandler.stop(id);
      process.exit();
    };

    process.on('SIGINT', exitHandler); // Handle Ctrl+C
    process.on('SIGTERM', exitHandler); // Handle termination signals

    await runFlow(id, flowHandler, jobDefinition, repository, options);

    const result = repository.getFlowState(id);

    console.log(
      'result: ',
      util.inspect(result, { showHidden: false, depth: null, colors: true }),
    );
    process.exit();
  } catch (error: any) {
    console.log(error);
    process.exit();
  }
}

async function runFlow(
  id: string,
  flowHandler: FlowHandler,
  jobDefinition: JobDefinition,
  repository: NodeRepository,
  options: any,
): Promise<FlowState> {
  try {
    flowHandler.init(id);

    const validation: IValidation<JobDefinition> =
      validateJobDefinition(jobDefinition);

    if (!validation.success) {
      repository.updateflowState(id, {
        endTime: Date.now(),
        status: 'failed',
      });
      repository.updateflowStateError(id, {
        status: 'validation-error',
        errors: validation.errors,
      });
      return repository.getFlowState(id);
    }

    flowHandler.start(id, jobDefinition);
    await flowHandler.run(id);

    return repository.getFlowState(id);
  } catch (error) {
    repository.updateflowState(id, {
      endTime: Date.now(),
      status: 'failed',
    });
    repository.updateflowStateError(id, {
      status: 'error',
      errors: error,
    });
    await flowHandler.stop(id);
    return repository.getFlowState(id);
  }
}

async function resolveJobDefination(
  options: {
    [key: string]: any;
  },
  jobDefinitionFile: string,
): Promise<JobDefinition> {
  let jobDefinition: JobDefinition;

  if (options.url) {
    try {
      const data = await fetch(options.url);
      const json = await data.json();
      jobDefinition = json;
    } catch (e) {
      throw new Error(`Failed to fetch remote job flow.\n${e}`);
    }
  } else {
    if (!jobDefinitionFile) {
      throw new Error('Missing Job Definition Argument');
    }
    jobDefinition = JSON.parse(fs.readFileSync(jobDefinitionFile, 'utf8'));
  }

  return jobDefinition;
}
