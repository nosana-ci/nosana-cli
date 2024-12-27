import { EventEmitter } from 'events';
import { JobDefinitionStrategy } from '../JobDefinitionStrategy.js';
import { JobDefinition } from '../../../../provider/types.js';

export class ApiListenJobDefinitionStrategy implements JobDefinitionStrategy {
  constructor(private eventEmitter: EventEmitter) {}

  async load(jobId: string): Promise<JobDefinition> {
    console.log('waiting for job definition');

    return new Promise((resolve, reject) => {
      const onJobDefinition = (data: {
        jobDefinition: JobDefinition;
        id: string;
      }) => {
        if (data.id === jobId) {
          clearTimeout(timeout); // Clear the timeout if the job definition is found
          resolve(data.jobDefinition);
          this.eventEmitter.removeListener('job-definition', onJobDefinition);
        }
      };

      // Set a timeout to reject if the job definition isn't received within 5 minutes
      const timeout = setTimeout(() => {
        this.eventEmitter.removeListener('job-definition', onJobDefinition);
        reject(
          new Error('Timeout: Job definition not received within 5 minutes'),
        );
      }, 300000); // 300000 ms = 5 minutes

      this.eventEmitter.on('job-definition', onJobDefinition);
    });
  }
}
