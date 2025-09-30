import chalk from 'chalk';
import { Client } from '@nosana/sdk';
import { confirm, input } from '@inquirer/prompts';

import { configs } from '../../configs/configs.js';

import { specsAndNetworkJob } from '../../../../static/staticsImports.js';
import { Provider } from '../../provider/Provider.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { Flow, OpState } from '../../provider/types.js';
import { generateRandomId } from '../../../../providers/utils/generate.js';
import TaskManager from '../task/TaskManager.js';

export class RegisterHandler {
  private nodeId: string;
  private answers:
    | {
        email: string;
        discord: string | undefined;
        twitter: string | undefined;
      }
    | undefined;

  constructor(
    private sdk: Client,
    private provider: Provider,
    private repository: NodeRepository,
  ) {
    this.nodeId = this.sdk.solana.provider!.wallet.publicKey.toString();

    applyLoggingProxyToClass(this);
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

  private async runSpecs(): Promise<Flow> {
    const flowId = generateRandomId(32);
    const task = new TaskManager(
      this.provider,
      this.repository,
      flowId,
      this.sdk.solana.wallet.publicKey.toString(),
      specsAndNetworkJob,
    );
    task.bootstrap();
    await task.start();

    const result = this.repository.getflow(flowId);

    if (!result || result.state.status !== 'success') {
      throw new Error('Registration Benchmark Failed');
    }

    return result;
  }

  private async submitOnboarding(results: OpState[]) {
    try {
      const headers = new Headers();
      headers.append('Authorization', await this.generateHeaders());

      const joinTestGridResult = await fetch(
        `${configs().backendUrl}/nodes/join-test-grid`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...this.answers!,
            nodeAddress: this.nodeId,
            results,
          }),
        },
      );

      if (!joinTestGridResult.ok) {
        console.error('Error whilst submiting onboarding request.');
        process.exit();
      }
    } catch (error) {
      console.error('Error whilst submiting onboarding request.', error);
      process.exit();
    }
  }

  async register() {
    await this.gainConstent();
    const results = await this.runSpecs();
    await this.submitOnboarding(results.state.opStates);
  }
}
