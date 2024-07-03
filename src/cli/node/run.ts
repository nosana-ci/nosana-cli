import { DockerProvider } from '../../providers/DockerProvider.js';
import {
  Provider,
  Flow,
  JobDefinition,
  FlowState,
  OperationArgsMap,
} from '../../providers/Provider.js';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import util from 'util';
import { PodmanProvider } from '../../providers/PodmanProvider.js';

let flow: Flow | undefined;
let provider: Provider;

export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: any;
  },
) {
  let handlingSigInt: Boolean = false;
  const onShutdown = async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      console.log(chalk.yellow.bold('Shutting down..'));
      if (flow) {
        const spinner = ora(chalk.cyan(`Stopping flow ${flow.id}`)).start();
        try {
          await provider.stopFlow(flow.id);
          await provider.waitForFlowFinish(flow.id);
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

  switch (options.provider) {
    case 'podman':
      provider = new PodmanProvider(options.podman, options.config);
      break;
    case 'docker':
    default:
      provider = new DockerProvider(options.podman, options.config);
      break;
  }
  let spinner = ora(chalk.cyan('Checking provider health')).start();
  try {
    await provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
  }
  switch (options.provider) {
    case 'docker':
    default:
      spinner.succeed(
        chalk.green(`Podman is running on ${chalk.bold(options.podman)}`),
      );
      break;
  }
  const jobDefinition: JobDefinition = JSON.parse(
    fs.readFileSync(jobDefinitionFile, 'utf8'),
  );
  let result: Partial<FlowState> | null = null;
  try {
    flow = provider.run(jobDefinition);
    const isFlowExposed =
      jobDefinition.ops.filter(
        (op) =>
          op.type === 'container/run' &&
          (op.args as OperationArgsMap['container/run']).expose,
      ).length > 0;
    result = await provider.waitForFlowFinish(
      flow.id,
      (event: { log: string; type: string }) => {
        if (!handlingSigInt) {
          if (event.type === 'info') {
            console.log(event.log);
          } else {
            if (!isFlowExposed) {
              if (event.type === 'stdout') {
                process.stdout.write(event.log);
              } else {
                process.stderr.write(event.log);
              }
            }
          }
        }
      },
    );
    console.log(
      'result: ',
      util.inspect(result, { showHidden: false, depth: null, colors: true }),
    );
  } catch (error) {
    spinner.fail(chalk.red.bold(error));
  }
  if (provider.clearFlowsCronJob) {
    provider.clearFlowsCronJob.stop();
  }
}
