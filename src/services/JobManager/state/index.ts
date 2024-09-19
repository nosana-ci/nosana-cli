import { LowSync } from 'lowdb/lib';

import { JobObject } from '../listener/types/index.js';
import { ReactiveEvent, ReactiveState } from './helper/reactiveState.js';
import { JobDB, JobDb } from '../db/index.js';

export class JobManagerState {
  private db: LowSync<JobDb>;
  private state: ReactiveState<string, JobObject>;

  constructor(config: string) {
    this.db = new JobDB(config).db;

    this.state = new ReactiveState<string, JobObject>();
    Object.entries(this.db.data.jobs).forEach(([id, job]) => {
      this.state.set(id, job);
    });
  }

  delete(key: string): void {
    if (this.state.delete(key)) {
      delete this.db.data.jobs[key];
      this.db.write();
    }
  }

  get(key: string): JobObject | undefined {
    return this.state.get(key);
  }

  list(): JobObject[] {
    return this.state.list();
  }

  set(
    key: string,
    stateOrCallback:
      | JobObject
      | ((current: JobObject | undefined) => JobObject),
  ): void {
    let value: JobObject;
    if (typeof stateOrCallback === 'function') {
      value = stateOrCallback(this.state.get(key));
    } else {
      value = stateOrCallback;
    }

    this.db.data.jobs[key] = value;
    this.db.write();

    this.state.set(key, value);
  }

  subscribe(
    key: string,
    callback: (event: ReactiveEvent, value: JobObject) => void,
  ) {
    this.state.addListener(key, callback);
    const initValue = this.state.get(key);
    if (initValue) callback('CREATE', initValue);
  }

  unsubscribe(key: string): void {
    this.state.removeListener(key);
  }
}
