export type SystemInfoResults = {
  system_environment: string;
  cpu_model: string;
  ram_mb: number;
  disk_gb: number;
  physical_cores: number;
  logical_cores: number;
};

export type NetworkInfoResults = {
  ip: string;
  country: string;
  ping_ms: number;
  download_mbps: number;
  upload_mbps: number;
};
