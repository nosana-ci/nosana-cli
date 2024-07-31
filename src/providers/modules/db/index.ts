import fs from 'fs';
import os from 'os';
import { LowSync } from 'lowdb/lib';
import { JSONFileSyncPreset } from 'lowdb/node';

import { NodeDb } from '../../BasicProvider';

// JS Factory
export function createDB(configLocation: string): LowSync<NodeDb> {
  let _db: LowSync<NodeDb>;

  if (configLocation[0] === '~') {
    configLocation = configLocation.replace('~', os.homedir());
  }

  fs.mkdirSync(configLocation, { recursive: true });

  _db = JSONFileSyncPreset<NodeDb>(`${configLocation}/nosana_db.json`, {
    resources: {
      images: {},
      volumes: {},
    },
    flows: {},
  });

  return _db;
}

// JS Class

export class DB {
  public db: LowSync<NodeDb>;

  constructor(configLocation: string) {
    if (configLocation[0] === '~') {
      configLocation = configLocation.replace('~', os.homedir());
    }

    fs.mkdirSync(configLocation, { recursive: true });
    const resources = {
      images: {},
      volumes: {},
    };
    const flows = {};
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
