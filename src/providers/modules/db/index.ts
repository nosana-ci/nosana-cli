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
    images: {},
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

    this.db = JSONFileSyncPreset<NodeDb>(`${configLocation}/nosana_db.json`, {
      images: {},
      flows: {},
    });
  }
}
