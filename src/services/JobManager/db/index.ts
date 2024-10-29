import fs from 'fs';
import os from 'os';
import { LowSync } from 'lowdb/lib';
import { JSONFileSyncPreset } from 'lowdb/node';

import { JobObject } from '../../../services/JobManager/listener/types/index.js';

export type JobDb = {
  jobs: {
    [key: string]: JobObject;
  };
};

const initial_state = {
  jobs: {},
};

export class JobDB {
  public db: LowSync<JobDb>;

  constructor(configLocation: string) {
    if (configLocation[0] === '~') {
      configLocation = configLocation.replace('~', os.homedir());
    }

    fs.mkdirSync(configLocation, { recursive: true });

    this.db = JSONFileSyncPreset<JobDb>(
      `${configLocation}/nosana_job_db.json`,
      initial_state,
    );

    if (!this.db.data.jobs) {
      this.db.data.jobs = initial_state.jobs;
    }

    this.db.write();
  }
}
