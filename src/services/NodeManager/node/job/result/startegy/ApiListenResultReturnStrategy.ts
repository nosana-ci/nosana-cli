import EventEmitter from 'events';
import { ResultReturnStrategy } from '../ResultReturnStrategy.js';

export class ApiListenResultReturnStrategy implements ResultReturnStrategy {
  constructor(private eventEmitter: EventEmitter) {}

  async load(jobId: string): Promise<boolean> {
    console.log('waiting for job result collection');

    return new Promise((resolve, reject) => {
      const onResultReturn = (data: { id: string }) => {
        if (data.id === jobId) {
          clearTimeout(timeout); // Clear the timeout if the result is received
          resolve(true);
          this.eventEmitter.removeListener('job-result', onResultReturn);
        }
      };

      // Set a timeout to reject if the result isn't received within 5 minutes
      const timeout = setTimeout(() => {
        this.eventEmitter.removeListener('job-result', onResultReturn);
        reject(new Error('Timeout: Job result not received within 5 minutes'));
      }, 300000); // 300000 ms = 5 minutes

      this.eventEmitter.on('job-result', onResultReturn);
    });
  }
}
