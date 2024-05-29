import { DockerProvider } from '../../providers/DockerProvider.js';
import {
  Provider,
  Flow,
  JobDefinition,
  validateJobDefinition,
  FlowState,
} from '../../providers/Provider.js';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import fs from 'node:fs';
import { IValidation } from 'typia';
import { input, confirm } from '@inquirer/prompts';
import { PodmanProvider } from '../../providers/PodmanProvider.js';
import { Client } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import { config } from '../../config.js';
import benchmark from '../../benchmark.json' assert { type: 'json' };

let flow: Flow | undefined;
let provider: Provider;

export async function runBenchmark(options: { [key: string]: any }) {
  const nosana: Client = getSDK();
  const node = nosana.solana.provider!.wallet.publicKey.toString();
  let spinner: Ora;

  let handlingSigInt: Boolean = false;
  const onShutdown = async () => {
    if (!handlingSigInt) {
      handlingSigInt = true;
      console.log(chalk.yellow.bold('Shutting down..'));
      if (spinner) {
        spinner.stop();
      }
      if (flow) {
        spinner = ora(chalk.cyan(`Stopping flow ${flow.id}`)).start();
        try {
          await provider.stopFlow(flow.id);

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
  process.on('SIGTERM ', onShutdown);

  console.log(`Provider:\t${chalk.greenBright.bold(options.provider)}`);
  switch (options.provider) {
    case 'podman':
      provider = new PodmanProvider(options.podman, options.config, node);
      break;
    case 'docker':
    default:
      provider = new DockerProvider(options.podman, options.config);
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

  // @ts-expect-error todo fix
  const jobDefinition: JobDefinition = benchmark;
  let result: Partial<FlowState> | null;

  const validation: IValidation<JobDefinition> =
    validateJobDefinition(jobDefinition);
  spinner.stop();
  let answers;
  if (!validation.success) {
    spinner.fail(chalk.red.bold('Job Definition validation failed'));
    console.error(validation.errors);
    result = {
      status: 'validation-error',
      errors: validation.errors,
    };
  } else {
    spinner.stop();
    answers = {
      email: await input({
        message: 'Your Email Address',
        validate: (value) => /\S+@\S+\.\S+/.test(value),
      }),
      discord: await input({
        message:
          "What is your Discord username? (If you don't use Discord, leave blank)",
      }),
      twitter: await input({
        message:
          "What is your Twitter username? (If you don't use Twitter, leave blank)",
      }),
    };
    if (!answers.email) {
      console.log(chalk.red('Email address is required'));
      process.exit();
    }

    const accept = await confirm({
      message:
        'Have you read the Participation Agreement and agree to the terms and conditions contained within?',
    });
    if (!accept) {
      console.log(
        chalk.red('To continue you must agree to the terms and conditions'),
      );
      process.exit();
    }
    console.log(chalk.cyan('Running benchmark'));
    // Create new flow
    flow = provider.run(jobDefinition);
    result = await provider.waitForFlowFinish(
      flow.id,
      (log: { log: string; type: string }) => {
        if (log.type === 'info') {
          console.log(log.log);
        } else if (log.type === 'stdout') {
          process.stdout.write(log.log);
        } else {
          process.stderr.write(log.log);
        }
      },
    );
  }

  if (result && result.status === 'success' && result.opStates && answers) {
    try {
      const response = await fetch(
        `${config.backendUrl}/nodes/join-test-grid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodeAddress: node,
            results: result.opStates,
            email: answers.email,
            discord: answers.discord,
            twitter: answers.twitter,
          }),
        },
      );
      const data = await response.json();
      if ((data && data.name === 'Error') || data.errors) {
        if (data.errors) {
          throw new Error(data.errors[0]);
        }
        throw new Error(data.message);
      }
      // console.log(data);

      console.log(chalk.green('Benchmark finished'));
      console.log('================================');
      console.log(
        chalk.green(
          "Thank you for registering for Nosana Node. \nWe'll review your registration and you will get an email from us if you are selected.",
        ),
      );
      process.exit();
    } catch (error) {
      console.error(error);
      throw new Error(chalk.red.bold('Failed to register'));
    }
  } else {
    if (
      result &&
      result.opStates &&
      result.opStates[0] &&
      result.opStates[0].logs[0].type === 'nodeerr'
    ) {
      console.log(chalk.red(result.opStates[0].logs[0].log));
    }
    throw new Error(
      chalk.red(
        `Couldn't succesfully run benchmark, finished with status: ${
          result ? result.status : 'cleared'
        }`,
      ),
    );
  }
}
