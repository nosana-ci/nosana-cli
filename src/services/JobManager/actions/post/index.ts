export type PostJobResult = {
  job: string;
  tx: string;
  job_timeout: number;
  created_at: string;
  service_url: string | undefined;
};
