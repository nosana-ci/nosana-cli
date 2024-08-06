import fs from 'fs';
import os from 'os';
import { LowSync } from 'lowdb/lib';
import { JSONFileSyncPreset } from 'lowdb/node';

import { NodeDb } from '../../BasicProvider';

const flows = {};

const resources = {
  images: {},
  volumes: {},
};

export class DB {
  public db: LowSync<NodeDb>;

  constructor(configLocation: string) {
    if (configLocation[0] === '~') {
      configLocation = configLocation.replace('~', os.homedir());
    }

    fs.mkdirSync(configLocation, { recursive: true });

    this.db = JSONFileSyncPreset<NodeDb>(`${configLocation}/nosana_db.json`, {
      resources,
      flows,
    });

    if (!this.db.data.resources) {
      this.db.data.resources = resources;
    }
    if (!this.db.data.flows) {
      this.db.data.flows = flows;
    }

    this.db.write();
  }
}
