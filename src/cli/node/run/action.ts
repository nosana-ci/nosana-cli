import fs from 'node:fs';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import util from 'util';

import {
  Flow,
  JobDefinition,
  FlowState,
  OperationArgsMap,
  ProviderEvents,
} from '../../../providers/Provider.js';
import { NosanaNode } from '../../../services/NosanaNode.js';
import { Operation, OperationType } from '../../../providers/Provider.js';
import { Client } from '@nosana/sdk';

let flow: Flow | undefined;
let node: NosanaNode;

export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: string | undefined;
  },
) {
  let handlingSigInt: Boolean = false;
  const onShutdown = async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      console.log(chalk.yellow.bold('Shutting down..'));
      if (node) {
        await node.shutdown();
      }
      if (flow) {
        const spinner = ora(chalk.cyan(`Stopping flow ${flow.id}`)).start();
        try {
          await node.provider.stopFlow(flow.id);
          await node.provider.waitForFlowFinish(flow.id);
          spinner.succeed(chalk.green(`Flow succesfully stopped`));
        } catch (e) {
          spinner.fail(chalk.red.bold('Could not stop flow'));
          throw e;
        }
      }
      handlingSigInt = false;
      process.exit();
    }
  };
  process.on('SIGINT', onShutdown);
  process.on('SIGTERM', onShutdown);
  let spinner: Ora = ora();
  let streamingLogs: boolean = false;
  node = new NosanaNode(
    new Client(), // sdk client not used during `node run`
    options.provider,
    options.podman,
    options.config,
  );
  node.logger.override(
    ProviderEvents.INFO_LOG,
    (event: { log: string; type: string; pending: boolean }) => {
      if (!handlingSigInt) {
        if (event.type === 'info' && event.pending && streamingLogs) {
          // If we want to start a spinner during streamingLogs, disable it
          event.pending = false;
        }
        node.logger.standard_info_log(event, spinner);
      }
    },
  );
  spinner = ora(chalk.cyan('Checking provider health')).start();
  try {
    await node.provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  spinner.succeed(
    chalk.green(
      `${chalk.bold(node.provider.name)} is running on ${chalk.bold(
        `${node.provider.protocol}://${node.provider.host}:${node.provider.port}`,
      )}`,
    ),
  );

  const jobDefinition: JobDefinition = JSON.parse(
    fs.readFileSync(jobDefinitionFile, 'utf8'),
  );
  let result: Partial<FlowState> | null = null;
  try {
    flow = node.provider.run(jobDefinition);
    const isFlowExposed =
      jobDefinition.ops.filter(
        (op: Operation<OperationType>) =>
          op.type === 'container/run' &&
          (op.args as OperationArgsMap['container/run']).expose,
      ).length > 0;
    streamingLogs = true;
    result = await node.provider.waitForFlowFinish(
      flow.id,
      (event: { log: string; type: string }) => {
        if (!handlingSigInt && !isFlowExposed) {
          if (event.type === 'stdout') {
            process.stdout.write(event.log);
          } else {
            process.stderr.write(event.log);
          }
        }
      },
    );
    streamingLogs = false;
    console.log(
      'result: ',
      util.inspect(result, { showHidden: false, depth: null, colors: true }),
    );
  } catch (error) {
    spinner.fail(chalk.red.bold(error));
  }
  if (node.provider.clearFlowsCronJob) {
    node.provider.clearFlowsCronJob.stop();
  }
}
