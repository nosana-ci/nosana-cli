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
import { IValidation } from 'typia';
import { createLoggingProxy } from '../../../services/NodeManager/monitoring/proxy/loggingProxy.js';
import { log } from '../../../services/NodeManager/monitoring/log/NodeLog.js';
import {
  ConsoleLogger,
  consoleLogging,
} from '../../../services/NodeManager/monitoring/log/console/ConsoleLogger.js';
import EventEmitter from 'events';
import TaskManager, { StopReasons, TaskManagerOps } from '../../../services/NodeManager/node/task/TaskManager.js';
import { sleep } from '@nosana/sdk';
import { loadJobDefinitionFromFile } from '../../../providers/utils/jobDefinitionParser.js';

export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: any;
  },
) {
  try {
    const jobDefinition = await resolveJobDefination(options, jobDefinitionFile)

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

    /**
     * set up log listening, any instance can listen to log produces from the node
     * the logs are produces from the log proxy
     */
    log();

    const logger = new ConsoleLogger(false);
    logger.addObserver();

    const job = `job-${Math.random().toString(36).slice(2, 10)}`;

    const tm = new TaskManager(provider, repository, job, jobDefinition);
    tm.bootstrap();

    const exitHandler = async () => {
      await tm.stop(StopReasons.STOPPED);
    };

    process.on('SIGINT', exitHandler); // Handle Ctrl+C
    process.on('SIGTERM', exitHandler); // Handle termination signals

    await tm.start();

    const result = repository.getFlowState(job);

    console.log(
      '\nResult: ',
      util.inspect(result, { showHidden: false, depth: null, colors: true }),
    );
  } catch (error: any) {
    const formattedError = `
      ========== ERROR ==========
      Timestamp: ${new Date().toISOString()}
      Error Name: ${error.name || 'Unknown Error'}
      Message: ${error.message || 'No message available'}${options.verbose
        ? `
      Trace: ${error.stack ?? error.trace}`
        : ''
      }
      ============================
      `;

    console.error(formattedError);
  }
  process.exit();
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
    jobDefinition = loadJobDefinitionFromFile(jobDefinitionFile);
  }

  return jobDefinition;
}
