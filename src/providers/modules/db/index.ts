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
    country: string;
    network: {
      ip: string;
      ping_ms: number;
      download_mbps: number;
      upload_mbps: number;
    };
    cpu: {
      model: string;
      physical_cores: number;
      logical_cores: number;
    };
    disk_gb: number;
    ram_mb: number;
    gpus: CudaCheckSuccessResponse;
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
    country: '',
    network: {
      ip: '',
      ping_ms: 0,
      download_mbps: 0,
      upload_mbps: 0,
    },
    cpu: {
      model: '',
      physical_cores: 0,
      logical_cores: 0,
    },
    disk_gb: 0,
    ram_mb: 0,
    gpus: {
      devices: [],
      runtime_version: 0,
      cuda_driver_version: 0,
      nvml_driver_version: 0,
    },
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
