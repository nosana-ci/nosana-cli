import { LowSync } from 'lowdb/lib';

import { JobObject } from '../listener/types/index.js';
import { ReactiveEvent, ReactiveState } from './helper/reactiveState.js';
import { DB, NodeDb } from '../../../providers/modules/db/index.js';

export class JobManagerState {
  private db: LowSync<NodeDb>;
  private state: ReactiveState<string, JobObject>;

  constructor(config: string) {
    this.db = new DB(config).db;
    this.state = new ReactiveState();
  }

  delete(key: string): void {
    if (this.state.delete(key)) {
      delete this.db.data.jobs[key];
    }
  }

  get(key: string): JobObject | undefined {
    return this.state.get(key);
  }

  list(): JobObject[] {
    return this.state.list();
  }

  set(key: string, value: JobObject): void {
    this.state.set(key, value);
    // @ts-ignore
    // this.db.data.jobs[key] = value;
  }

  subscribe(
    key: string,
    callback: (event: ReactiveEvent, value: JobObject) => void,
  ): void {
    this.state.addListener(key, callback);
  }

  unsubscribe(key: string): void {
    this.state.removeListener(key);
  }
}
