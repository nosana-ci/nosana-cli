import { SendJobDefinationLogicstics, JobDefinition } from '@nosana/sdk';
import ApiEventEmitter from '../../api/ApiEventEmitter.js';
import { ApiListenJobDefinitionStrategy } from './strategy/ApiListenJobDefinitionStrategy.js';
import { ApiJobDefinitionStrategy } from './strategy/ApiJobDefinitionStrategy.js';

export interface JobDefinitionStrategy {
  load(
    jobId: string,
    args: SendJobDefinationLogicstics['args'],
  ): Promise<JobDefinition>;
}

export class JobDefinitionStrategySelector {
  constructor() {}

  /**
   * Selects the appropriate JobDefinitionStrategy based on the name.
   * @param name - The name/type of the strategy ('api-listen' or 'api').
   * @returns JobDefinitionStrategy
   */
  selectStrategy(name: string): JobDefinitionStrategy {
    switch (name) {
      case 'api-listen':
        return new ApiListenJobDefinitionStrategy(
          ApiEventEmitter.getInstance(),
        );
      case 'api':
        return new ApiJobDefinitionStrategy(); // assuming you have an ApiJobDefinitionStrategy
      default:
        throw new Error(`Unsupported strategy: ${name}`);
    }
  }
}
