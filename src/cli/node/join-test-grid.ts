import { DockerProvider } from '../../providers/DockerProvider';
import {
  Provider,
  Flow,
  JobDefinition,
  validateJobDefinition,
  FlowState,
} from '../../providers/Provider';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import fs from 'node:fs';
import { IValidation } from 'typia';
import util from 'util';
import { PodmanProvider } from '../../providers/PodmanProvider';
import { Client } from '@nosana/sdk';
import { getSDK } from '../../services/sdk';

let flow: Flow | undefined;
let provider: Provider;

export async function runBenchmark(options: { [key: string]: any }) {
  const jobDefinitionFile = 'job-examples/benchmark.json';
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();
  let spinner: Ora;

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
  spinner = ora(chalk.cyan('Checking provider health')).start();
  try {
    await provider.healthy();
  } catch (error) {
    spinner.fail(
      chalk.red(`${chalk.bold(options.provider)} provider not healthy`),
    );
    throw error;
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
      (log: { log: string; type: string }) => {
        if (log.type === 'stdout') {
          process.stdout.write(log.log);
        } else {
          process.stderr.write(log.log);
        }
      },
    );
  }
  spinner.stop();
  console.log('node', node);
  console.log(
    'result: ',
    util.inspect(result, { showHidden: false, depth: null, colors: true }),
  );
  // TODO: api request to backend with results & node address
}
