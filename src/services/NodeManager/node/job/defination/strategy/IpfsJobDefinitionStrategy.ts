import { Client as SDK } from '@nosana/sdk';
import { JobDefinitionStrategy } from '../JobDefinitionStrategy.js';
import { JobDefinition } from '../../../../provider/types.js';

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
