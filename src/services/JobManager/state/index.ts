import { LowSync } from 'lowdb/lib';

import { JobObject } from '../listener/types/index.js';
import { ReactiveEvent, ReactiveState } from './helper/reactiveState.js';
import { DB, NodeDb } from '../../../providers/modules/db/index.js';

export class JobManagerState {
  private db: LowSync<NodeDb>;
  private state: ReactiveState<string, JobObject>;

  constructor(config: string) {
    this.db = new DB(config).db;

    this.state = new ReactiveState<string, JobObject>();
    Object.entries(this.db.data.jobs).forEach(([id, job]) => {
      this.state.set(id, job);
    });
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
    const current_entry = this.state.get(key);

    if (current_entry) {
      this.state.set(key, {
        id: value.id,
        active_nodes: [...value.active_nodes, ...current_entry.active_nodes],
        expired_nodes: [...value.expired_nodes, ...current_entry.expired_nodes],
      });
      return;
    }

    this.state.set(key, value);
    this.db.data.jobs[key] = value;
    this.db.write();
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
