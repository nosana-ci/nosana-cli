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
import EventEmitter from 'events';
import TaskManager, { TaskManagerOps } from '../../../services/NodeManager/node/task/TaskManager.js';
import { sleep } from '@nosana/sdk';

export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: any;
  },
  ) {
    const jobDefinition = JSON.parse(fs.readFileSync(jobDefinitionFile, 'utf8'));
    // const ops = jobDefinition.ops as TaskManagerOps;

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

    const emitter = new EventEmitter();

    const provider = new Provider(
      containerOrchestration,
      repository,
      resourceManager,
      emitter,
    );

    const job = 'test-job-2'
    const tm = new TaskManager(provider, repository, jobDefinition, job);
    tm.buildExecutionPlan();
    tm.init();

    // Schedule stop in 20 seconds
    setTimeout(() => {
      tm.stop("expired");
    }, 20000); // 20,000 ms = 20 seconds

    await tm.run(); // this blocks

    return
}

// This is still a WIP: i will still have to expose the logs and progress logs
// export async function runJob(
//   jobDefinitionFile: string,
//   options: {
//     [key: string]: any;
//   },
// ) {
//   try {
//     const jobDefinition: JobDefinition = await resolveJobDefination(
//       options,
//       jobDefinitionFile,
//     );

//     const db = new DB(options.config).db;
//     const repository = new NodeRepository(db);

//     const containerOrchestration = selectContainerOrchestrationProvider(
//       options.provider,
//       options.podman,
//       options.gpu,
//     );

//     const resourceManager = new ResourceManager(
//       containerOrchestration,
//       repository,
//     );

//     const emitter = new EventEmitter();

//     const provider = new Provider(
//       containerOrchestration,
//       repository,
//       resourceManager,
//       emitter,
//     );

//     const flowHandler = createLoggingProxy(
//       new FlowHandler(provider, repository),
//     );

//     emitter.on('run-exposed', (data) => {
//       flowHandler.operationExposed(data, undefined);
//     });

//     emitter.on('startup-success', (data) => {
//       flowHandler.operationExposed(data, true);
//     });

//     emitter.on('continuous-failure', (data) => {
//       flowHandler.operationExposed(data, false);
//     });

//     /**
//      * set up log listening, any instance can listen to log produces from the node
//      * the logs are produces from the log proxy
//      */
//     log();

//     const logger = new ConsoleLogger(false);
//     logger.addObserver();

//     const id = flowHandler.generateRandomId(32);

//     const exitHandler = async () => {
//       await flowHandler.stop(id);
//       process.exit();
//     };

//     process.on('SIGINT', exitHandler); // Handle Ctrl+C
//     process.on('SIGTERM', exitHandler); // Handle termination signals

//     await runFlow(id, flowHandler, jobDefinition, repository, options);

//     const result = repository.getFlowState(id);

//     console.log(
//       'result: ',
//       util.inspect(result, { showHidden: false, depth: null, colors: true }),
//     );
//     process.exit();
//   } catch (error: any) {
//     const formattedError = `
//       ========== ERROR ==========
//       Timestamp: ${new Date().toISOString()}
//       Error Name: ${error.name || 'Unknown Error'}
//       Message: ${error.message || 'No message available'}${
//       options.verbose
//         ? `
//       Trace: ${error.stack ?? error.trace}`
//         : ''
//     }
//       ============================
//       `;

//     console.error(formattedError);
//     process.exit();
//   }
// }

// async function runFlow(
//   id: string,
//   flowHandler: FlowHandler,
//   jobDefinition: JobDefinition,
//   repository: NodeRepository,
//   options: any,
// ): Promise<FlowState> {
//   try {
//     flowHandler.init(id);

//     const validation: IValidation<JobDefinition> =
//       validateJobDefinition(jobDefinition);

//     if (!validation.success) {
//       repository.updateflowState(id, {
//         endTime: Date.now(),
//         status: 'failed',
//       });
//       repository.updateflowStateError(id, {
//         status: 'validation-error',
//         errors: validation.errors,
//       });
//       return repository.getFlowState(id);
//     }

//     flowHandler.start(id, jobDefinition);
//     await flowHandler.run(id);

//     return repository.getFlowState(id);
//   } catch (error) {
//     repository.updateflowState(id, {
//       endTime: Date.now(),
//       status: 'failed',
//     });
//     repository.updateflowStateError(id, {
//       status: 'error',
//       errors: error,
//     });
//     await flowHandler.stop(id);
//     return repository.getFlowState(id);
//   }
// }

// async function resolveJobDefination(
//   options: {
//     [key: string]: any;
//   },
//   jobDefinitionFile: string,
// ): Promise<JobDefinition> {
//   let jobDefinition: JobDefinition;

//   if (options.url) {
//     try {
//       const data = await fetch(options.url);
//       const json = await data.json();
//       jobDefinition = json;
//     } catch (e) {
//       throw new Error(`Failed to fetch remote job flow.\n${e}`);
//     }
//   } else {
//     if (!jobDefinitionFile) {
//       throw new Error('Missing Job Definition Argument');
//     }
//     jobDefinition = JSON.parse(fs.readFileSync(jobDefinitionFile, 'utf8'));
//   }

//   return jobDefinition;
// }
