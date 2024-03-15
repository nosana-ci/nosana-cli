import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import {
  Provider,
  Flow,
  JobDefinition,
  validateJobDefinition,
  FlowState,
} from '../../providers/Provider';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import { IValidation } from 'typia';
import util from 'util';
import { PodmanProvider } from '../../providers/PodmanProvider';

let flow: Flow | undefined;
let provider: Provider;

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
      if (flow) {
        const spinner = ora(chalk.cyan(`Stopping flow ${flow.id}`)).start();
        try {
          await provider.clearFlow(flow.id);

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
    case 'podman':
      provider = new PodmanProvider(options.podman);
      break;
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
  let result: Partial<FlowState>;

  const validation: IValidation<JobDefinition> =
    validateJobDefinition(jobDefinition);
  if (!validation.success) {
    spinner.fail(chalk.red.bold('Job Definition validation failed'));
    console.error(validation.errors);
    result = {
      status: 'validation-error',
      errors: validation.errors,
    };
  } else {
    // Create new flow
    flow = provider.run(jobDefinition);
    result = await provider.waitForFlowFinish(
      flow.id,
      (log: { log: string; opIndex: number }) => {
        console.log(log);
      },
    );
  }
  console.log(
    'result: ',
    util.inspect(result, { showHidden: false, depth: null, colors: true }),
  );
}
