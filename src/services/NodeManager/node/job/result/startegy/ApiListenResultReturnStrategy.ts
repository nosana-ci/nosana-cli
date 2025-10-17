import EventEmitter from 'events';
import { ResultReturnStrategy } from '../ResultReturnStrategy.js';

export class ApiListenResultReturnStrategy implements ResultReturnStrategy {
  constructor(private eventEmitter: EventEmitter) {}

  async load(jobId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const onResultReturn = (data: { id: string }) => {
        if (data.id === jobId) {
          clearTimeout(timeout); // Clear the timeout if the result is received
          resolve(true);
          this.eventEmitter.removeListener('job-result', onResultReturn);
        }
      };

      // Set a timeout to reject if the result isn't received within 1 minutes
      const timeout = setTimeout(() => {
        this.eventEmitter.removeListener('job-result', onResultReturn);
        reject('Results were not collected before the timeout.');
      }, 1 * 60 * 1000); // 2 * 60 * 1000 ms = 1 minutes

      this.eventEmitter.on('job-result', onResultReturn);
    });
  }
}
