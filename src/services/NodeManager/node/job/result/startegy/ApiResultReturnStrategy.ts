import {
  FlowState,
  ReceiveJobResultLogicstics,
  SendJobDefinationLogicstics,
  sleep,
} from '@nosana/sdk';
import { ResultReturnStrategy } from '../ResultReturnStrategy.js';
import { getSDK } from '../../../../../sdk.js';

export class ApiResultReturnStrategy implements ResultReturnStrategy {
  private attempts = 0;
  private success = false;

  private async postJobResults(
    endpoint: string,
    headers: Headers,
    body: FlowState,
    orginalStatus: string,
  ) {
    if (this.attempts > 3) return;

    this.attempts += 1;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, status: orginalStatus }),
      });

      if (response.ok) {
        this.success = true;
      }
    } catch {}

    if (!this.success) {
      await sleep(10);
      await this.postJobResults(endpoint, headers, body, orginalStatus);
    }
  }

  async load(
    jobId: string,
    args: ReceiveJobResultLogicstics['args'],
    results: FlowState,
    orginalStatus: string,
  ): Promise<boolean> {
    if (!args.endpoint)
      throw new Error('Api result logictic requires an endpoint.');

    const endpoint = args.endpoint.replace('%%global.job%%', jobId);

    const headers = await getSDK().authorization.generateHeader(jobId, {
      includeTime: true,
    });
    headers.append('Content-Type', 'application/json');
    await this.postJobResults(endpoint, headers, results, orginalStatus);

    if (!this.success) {
      throw new Error(`Failed to post results to ${endpoint}.`);
    }

    return this.success;
  }
}
