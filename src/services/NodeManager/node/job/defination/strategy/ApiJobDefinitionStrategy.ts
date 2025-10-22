import { JobDefinitionStrategy } from '../JobDefinitionStrategy.js';
import { SendJobDefinationLogicstics, sleep, JobDefinition } from '@nosana/sdk';
import { getSDK } from '../../../../../sdk.js';

export class ApiJobDefinitionStrategy implements JobDefinitionStrategy {
  private attempts = 0;
  private jobDefinition: JobDefinition | undefined = undefined;

  private async retrieveJobDefinition(endpoint: string, headers: Headers) {
    if (this.attempts > 3) return;

    this.attempts += 1;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        this.jobDefinition = await response.json();
      }
    } catch {}

    if (!this.jobDefinition) {
      await sleep(10);
      await this.retrieveJobDefinition(endpoint, headers);
    }
  }

  async load(
    jobId: string,
    args: SendJobDefinationLogicstics['args'],
  ): Promise<JobDefinition> {
    if (!args.endpoint)
      throw new Error('Api Job definition logistic requires an endpoint.');

    const endpoint = args.endpoint.replace('%%global.job%%', jobId);

    const headers = await getSDK().authorization.generateHeader(jobId, {
      includeTime: true,
    });
    await this.retrieveJobDefinition(endpoint, headers);

    if (!this.jobDefinition) {
      throw new Error(`Failed to retrieve job definition from ${endpoint}.`);
    }

    return this.jobDefinition;
  }
}
