import chalk from 'chalk';
import { Client, Flow } from '@nosana/sdk';
import { confirm, input } from '@inquirer/prompts';

import { FlowHandler } from '../flow/flowHandler.js';
import { clientSelector, QueryClient } from '../../../../api/client.js';
import { configs } from '../../configs/configs.js';

import { jobDefinition } from '../../../../static/staticsImports.js';

export class RegisterHandler {
  private sdk: Client;
  private nodeId: string;
  private flowHandler: FlowHandler;
  private client: QueryClient;
  private answers:
    | {
        email: string;
        discord: string | undefined;
        twitter: string | undefined;
      }
    | undefined;

  constructor(sdk: Client, flowHandler: FlowHandler) {
    this.sdk = sdk;
    this.nodeId = this.sdk.solana.provider!.wallet.publicKey.toString();
    this.flowHandler = flowHandler;
    this.client = clientSelector();
  }

  private async gainConstent() {
    this.answers = {
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

    if (!this.answers.email) {
      console.log(chalk.red('Email address is required'));
      process.exit();
    }

    const accept = await confirm({
      message: `Have you read the Participation Agreement and agree to the terms and conditions contained within?\nParticipation agreement: ${chalk.blue(
        'https://drive.google.com/file/d/1dFWCT5Zon08pCPrftdxB9ByvbuDafTwy/view',
      )}`,
    });
    if (!accept) {
      console.log(
        chalk.red('To continue you must agree to the terms and conditions'),
      );
      process.exit();
    }
  }

  // TODO: convert backend to support sdk.authorization.generate()
  private async generateHeaders() {
    const conf = configs();

    const signature = (await this.sdk.solana.signMessage(
      conf.signMessage,
    )) as Uint8Array;
    const base64Signature = Buffer.from(signature).toString('base64');

    return `${this.nodeId}:${base64Signature}`;
  }

  private async runBenchmark(): Promise<Flow> {
    const flowId = this.flowHandler.generateRandomId(32);
    this.flowHandler.start(flowId, jobDefinition);
    const result = await this.flowHandler.run(flowId);

    return result;
  }

  private async submitOnboarding(results: unknown[]) {
    const { error } = await this.client.POST('/api/nodes/join-test-grid', {
      body: {
        ...this.answers!,
        nodeAddress: this.nodeId,
        results, // TODO: Fix this type within the backend
      },
      params: {
        header: {
          authorization: await this.generateHeaders(),
        },
      },
    });

    if (error) {
      console.error('Error whilst submiting onboarding request.');
      process.exit();
    }
  }

  async register() {
    await this.gainConstent();
    const results = await this.runBenchmark();
    await this.submitOnboarding(results.state.opStates);
  }
}
