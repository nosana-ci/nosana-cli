import { Client as SDK, JobDefinition } from '@nosana/sdk';
import { JobDefinitionStrategy } from '../JobDefinitionStrategy.js';

export class IpfsJobDefinitionStrategy implements JobDefinitionStrategy {
  constructor(private sdk: SDK) {}

  async load(id: string): Promise<JobDefinition> {
    try {
      return await this.sdk.ipfs.retrieve(id);
    } catch (e) {
      throw new Error(`Failed to load job from IPFS: ${(e as any).message}`);
    }
  }
}
