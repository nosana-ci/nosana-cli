import { IValidation } from 'typia';
import { OutputEvent, OutputEventParams } from '../outputEvents.js';
import { OutputFormatterAdapter } from '../OutputFormatter.js';
import { jsonOutputEventHandlers } from './JsonOutputEventHandlers.js';

export class JsonOutputFormatter implements OutputFormatterAdapter {
  private response: JsonResponseType = {};

  finalize() {
    console.log(`${JSON.stringify(this.response)}`);
  }

  output<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
    jsonOutputEventHandlers[event](this.response, param);
  }
}

export interface JsonResponseType {
  isError?: boolean;
  msg?: string;
  keypair_path?: string;
  balances?: {
    SOL: string;
    NOS: string;
  };
  network?: string;
  wallet?: string;
  ipfs_uploaded?: string;
  service_url?: string;
  job_url?: string;
  json_flow_url?: string;
  market_url?: string;
  price?: string;
  total_cost?: string;
  status?: string;
  job_posting?: {
    transaction_id?: string;
    market_id?: string;
    price_per_second?: string;
    total_cost?: string;
  };
  transaction_id?: string;
  errors?: string[] | Error[] | IValidation.IError[];
  node_url?: string;
  duration?: number;
  start_time?: Date;
  result_url?: string;
  executions?: Array<{
    operationId: string | null;
    duration: number;
    logs: string[];
    exitCode?: number | null;
    status?: string;
  }>;
}
