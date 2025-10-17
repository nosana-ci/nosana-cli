import { FlowState, ReceiveJobResultLogicstics } from '@nosana/sdk';

import ApiEventEmitter from '../../api/ApiEventEmitter.js';
import { ApiResultReturnStrategy } from './startegy/ApiResultReturnStrategy.js';
import { ApiListenResultReturnStrategy } from './startegy/ApiListenResultReturnStrategy.js';

export interface ResultReturnStrategy {
  load(
    jobId: string,
    args: ReceiveJobResultLogicstics['args'],
    results: FlowState,
    orginalState: string,
  ): Promise<boolean>;
}

export class ResultReturnStrategySelector {
  constructor() {}

  /**
   * Selects the appropriate JobDefinitionStrategy based on the name.
   * @param name - The name/type of the strategy ('api-listen' or 'api').
   * @returns JobDefinitionStrategy
   */
  selectStrategy(name: string): ResultReturnStrategy {
    switch (name) {
      case 'api-listen':
        return new ApiListenResultReturnStrategy(ApiEventEmitter.getInstance());
      case 'api':
        return new ApiResultReturnStrategy();
      default:
        throw new Error(`Unsupported strategy: ${name}`);
    }
  }
}
