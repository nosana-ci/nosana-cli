import EventEmitter from 'events';
import { ResultReturnStrategy } from '../ResultReturnStrategy.js';

export class ApiListenResultReturnStrategy implements ResultReturnStrategy {
  constructor(private eventEmitter: EventEmitter) {}

  async load(jobId: string): Promise<boolean> {
    console.log('waiting for job result collection');
    return new Promise((resolve, reject) => {
      const onResultReturn = (data: { id: string }) => {
        if (data.id === jobId) {
          resolve(true);
          this.eventEmitter.removeListener('job-result', onResultReturn);
        }
      };

      this.eventEmitter.on('job-result', onResultReturn);
    });
  }
}
