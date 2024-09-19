import EventEmitter from 'events';

export class StatusEmitter extends EventEmitter {
  close() {
    this.emit('close');
  }

  emitStatus(job_id: string, node: string, status: string | number) {
    this.emit('event', {
      event: 'status',
      job_id,
      node,
      status,
    });
  }
}
