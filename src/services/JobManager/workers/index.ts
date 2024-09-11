import EventEmitter from 'events';

export const JobWorkerEvents = {
  create: 'CREATE_WORKER',
  update: 'UPDATE_WORKER',
  stop: 'STOP_WORKER',
} as const;

export class JobWorker {
  private workersStore = new Map();

  public createWorker() {}

  public updateWorker() {}

  public removeWorker() {}
}
