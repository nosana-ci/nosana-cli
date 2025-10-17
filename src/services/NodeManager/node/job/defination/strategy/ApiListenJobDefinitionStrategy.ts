import { EventEmitter } from 'events';
import { JobDefinitionStrategy } from '../JobDefinitionStrategy.js';
import { JobDefinition } from '../../../../provider/types.js';

export class ApiListenJobDefinitionStrategy implements JobDefinitionStrategy {
  constructor(private eventEmitter: EventEmitter) {}

  async load(jobId: string): Promise<JobDefinition> {
    return new Promise((resolve, reject) => {
      const onJobDefinition = (data: {
        jobDefinition: JobDefinition;
        id: string;
      }) => {
        if (data.id === jobId) {
          resolve(data.jobDefinition);
          this.eventEmitter.removeListener('job-definition', onJobDefinition);
        }
      };
      this.eventEmitter.on('job-definition', onJobDefinition);
    });
  }
}
