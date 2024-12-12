import fs from 'fs';
import os from 'os';
import { LowSync } from 'lowdb/lib';
import { JSONFileSyncPreset } from 'lowdb/node';

import { Flow } from '../../Provider.js';
import { CudaCheckSuccessResponse } from '../../../types/cudaCheck.js';

export type NodeDb = {
  flows: { [key: string]: Flow };
  resources: Resources;
  info: {
    bandwidth: { [key: string]: number };
    country: string;
    cpu: string;
    disk_gb: number;
    gpus: CudaCheckSuccessResponse;
    ram_mb: number;
  };
};

export type Resources = {
  images: { [key: string]: ResourceHistory };
  volumes: { [key: string]: VolumeResource };
};

export type ResourceHistory = {
  lastUsed: Date;
  usage: number;
  required: boolean;
};

export type VolumeResource = ResourceHistory & {
  volume: string;
};

const initial_state: NodeDb = {
  resources: {
    images: {},
    volumes: {},
  },
  flows: {},
  info: {
    disk_gb: 0,
    gpus: {
      devices: [],
      runtime_version: 0,
    },
    bandwidth: {},
    country: '',
    cpu: '',
    ram_mb: 0,
  },
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
