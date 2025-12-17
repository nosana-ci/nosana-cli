import EventEmitter from 'events';
import type { JobResult } from '../../listener/types';

export class StatusEmitter extends EventEmitter {
  close() {
    this.emit('close');
  }

  emitCreate(job_id: string, job: JobResult) {
    this.emit('event', {
      event: 'create',
      job_id,
      job,
    });
  }

  emitStatus(job_id: string, node: string, status: string | number) {
    this.emit('event', {
      event: 'status',
      job_id,
      node,
      status,
    });
  }

  emitProgress(job_id: string, step: string) {
    this.emit('event', {
      event: 'progress',
      job_id,
      step,
    });
  }
}
