export type HealthcheckPayload = {
  id: string;
  flowId: string;
  port: number | string;
  service?: string;
};
