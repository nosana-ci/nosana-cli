import fs from 'fs';
import os from 'os';
import { LowSync } from 'lowdb/lib';
import { JSONFileSyncPreset } from 'lowdb/node';

import { Flow } from '../../Provider.js';

export type NodeDb = {
  flows: { [key: string]: Flow };
  resources: Resources;
  info: {
    [key: string]: string;
  };
};

type Resources = {
  images: { [key: string]: ResourceHistory };
  volumes: { [key: string]: VolumeResource };
};

type ResourceHistory = {
  lastUsed: Date;
  usage: number;
  required: boolean;
};

type VolumeResource = ResourceHistory & {
  volume: string;
};

const initial_state = {
  resources: {
    images: {},
    volumes: {},
  },
  flows: {},
  info: {},
};

export class DB {
  public db: LowSync<NodeDb>;

  constructor(configLocation: string) {
    if (configLocation[0] === '~') {
      configLocation = configLocation.replace('~', os.homedir());
    }

    fs.mkdirSync(configLocation, { recursive: true });

    this.db = JSONFileSyncPreset<NodeDb>(
      `${configLocation}/nosana_db.json`,
      initial_state,
    );

    if (!this.db.data.resources) {
      this.db.data.resources = initial_state.resources;
    }

    if (!this.db.data.flows) {
      this.db.data.flows = initial_state.flows;
    }

    if (!this.db.data.info) {
      this.db.data.info = initial_state.info;
    }

    this.db.write();
  }
}
