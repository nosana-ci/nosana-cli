import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import {
  BaseProvider,
  FlowState,
  JobDefinition,
  validateJobDefinition,
} from '../../providers/BaseProvider';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import { IValidation } from 'typia';

let flowId: string | undefined;
let provider: BaseProvider;

export async function runJob(
  jobDefinitionFile: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  let handlingSigInt: Boolean = false;
  process.on('SIGINT', async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      console.log(chalk.yellow.bold('Shutting down..'));
      if (flowId) {
        const spinner = ora(chalk.cyan(`Stopping flow ${flowId}`)).start();
        try {
          await provider.clearFlow(flowId);

          spinner.succeed(chalk.green(`Flow succesfully stopped`));
        } catch (e) {
          spinner.fail(chalk.red.bold('Could not stop flow'));
          throw e;
        }
      }
      handlingSigInt = false;
      process.exit();
    }
  });
  switch (options.provider) {
    case 'docker':
    default:
      provider = new DockerProvider(options.podman);
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
  let result: FlowState;

  const validation: IValidation<JobDefinition> =
    validateJobDefinition(jobDefinition);
  if (!validation.success) {
    spinner.fail(chalk.red.bold('Job Definition validation failed'));
    console.error(validation.errors);
    result = {
      id: '',
      provider: options.provider,
      startTime: Date.now(),
      endTime: Date.now(),
      ops: [],
      status: 'validation-error',
      errors: validation.errors,
    };
  } else {
    // Create new flow
    flowId = provider.run(jobDefinition);
    result = await provider.waitForFlowFinish(
      flowId,
      (log: { log: string; opIndex: number }) => {
        console.log(log);
      },
    );
  }

  console.log('result: ', result);
}
