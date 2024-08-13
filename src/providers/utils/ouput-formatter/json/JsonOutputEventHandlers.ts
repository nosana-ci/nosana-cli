import {
  BalanceLowParam,
  BalanceParam,
  DurationParam,
  IpfsParam,
  JobExecutionParam,
  JobNotFoundErrorParam,
  JobPostedErrorParam,
  JobPostingParam,
  JobPriceParam,
  JobStatusParam,
  JobUrlParam,
  JsonFlowTypeErrorParam,
  JsonFlowUrlParam,
  KeyfileParam,
  MarketUrlParam,
  NetworkParam,
  NodeUrlParam,
  NosBalanceLowParam,
  OUTPUT_EVENTS,
  ResultUrlParam,
  ServiceUrlParam,
  StartTimeParam,
  TotalCostParam,
  TxParam,
  ErrorParam,
  WalletParam,
  RetriveJobCommandParam,
  ValidationErrorParam,
  OutputHeaderLogoParam,
} from '../outputEvents.js';
import { OutputEventParams } from '../outputEvents.js';
import { JsonResponseType } from './JsonOutputFormatter.js';

type EventHandler<T extends keyof OutputEventParams> = (
  response: JsonResponseType,
  param: OutputEventParams[T],
) => void;

type OutputEventHandlers = {
  [K in keyof OutputEventParams]: EventHandler<K>;
};

export const jsonOutputEventHandlers: OutputEventHandlers = {
  [OUTPUT_EVENTS.READ_KEYFILE]: (
    response: JsonResponseType,
    param: KeyfileParam,
  ) => {
    response.keypair_path = param.keyfile;
  },

  [OUTPUT_EVENTS.CREATE_KEYFILE]: (
    response: JsonResponseType,
    param: KeyfileParam,
  ) => {
    response.keypair_path = param.keyfile;
  },

  [OUTPUT_EVENTS.OUTPUT_BALANCES]: (
    response: JsonResponseType,
    param: BalanceParam,
  ) => {
    response.balances = {
      SOL: `${param.sol} SOL`,
      NOS: `${param.nos} NOS`,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_NETWORK]: (
    response: JsonResponseType,
    param: NetworkParam,
  ) => {
    response.network = param.network;
  },

  [OUTPUT_EVENTS.OUTPUT_WALLET]: (
    response: JsonResponseType,
    param: WalletParam,
  ) => {
    response.wallet = param.publicKey;
  },

  [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: (
    response: JsonResponseType,
    param: IpfsParam,
  ) => {
    response.ipfs_uploaded = param.ipfsHash;
  },

  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: (
    response: JsonResponseType,
    param: ServiceUrlParam,
  ) => {
    response.service_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: (
    response: JsonResponseType,
    param: JobUrlParam,
  ) => {
    response.job_url = param.job_url;
  },

  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: (
    response: JsonResponseType,
    param: JsonFlowUrlParam,
  ) => {
    response.json_flow_url = param.json_flow_url;
  },

  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: (
    response: JsonResponseType,
    param: MarketUrlParam,
  ) => {
    response.market_url = param.market_url;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: (
    response: JsonResponseType,
    param: JobPriceParam,
  ) => {
    response.price = `${param.price} NOS/s`;
  },

  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: (
    response: JsonResponseType,
    param: TotalCostParam,
  ) => {
    response.total_cost = `${param.cost} NOS/s`;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: (
    response: JsonResponseType,
    param: JobStatusParam,
  ) => {
    response.status = param.status;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: (
    response: JsonResponseType,
    param: JobPostingParam,
  ) => {
    response.job_posting = {
      market_id: param.market_address,
      price_per_second: `${param.price} NOS/s`,
      total_cost: `${param.total} NOS`,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: (
    response: JsonResponseType,
    param: TxParam,
  ) => {
    response.job_posting = {
      transaction_id: param.tx,
      ...response.job_posting,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: (
    response: JsonResponseType,
    param: ValidationErrorParam,
  ) => {
    response.isError = true;
    response.msg = 'Job Definition validation failed';
    response.errors = param.error;
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_FAILED_TO_FETCH_MARKETS_ERROR]: (
    response: JsonResponseType,
    param: ErrorParam,
  ) => {
    response.isError = true;
    response.msg = 'Failed to fetch market';
    response.errors = [param.error];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: (
    response: JsonResponseType,
    param: JobPostedErrorParam,
  ) => {
    response.isError = true;
    response.msg = "Couldn't post job";
    response.errors = [param.error];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: (
    response: JsonResponseType,
    param: BalanceLowParam,
  ) => {
    response.isError = true;
    response.msg = `Minimum of '0.005' SOL needed: SOL available ${param.sol}`;
    response.errors = [
      `Minimum of '0.005' SOL needed: SOL available ${param.sol}`,
    ];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: (
    response: JsonResponseType,
    param: NosBalanceLowParam,
  ) => {
    response.isError = true;
    response.msg = `Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`;
    response.errors = [
      `Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`,
    ];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR]: (
    response: JsonResponseType,
    param: ErrorParam,
  ) => {
    response.isError = true;
    response.msg = 'Couldnt airdrop tokens to your address';
    response.errors = ['Couldnt airdrop tokens to your address'];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND]: (
    response: JsonResponseType,
    param: JobNotFoundErrorParam,
  ) => {
    response.isError = true;
    response.msg = 'Could not retrieve job';
    response.errors = [param.error];
  },

  [OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT]: (response: JsonResponseType) => {
    response.isError = true;
    response.msg = 'Cannot log results';
    response.errors = ['Cannot log results'];
  },

  [OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]: (
    response: JsonResponseType,
    param: ErrorParam,
  ) => {
    response.isError = true;
    response.msg = 'artifact support coming soon!';
    response.errors = ['artifact support coming soon!'];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR]: (
    response: JsonResponseType,
    param: JsonFlowTypeErrorParam,
  ) => {
    response.isError = true;
    response.msg = `type ${param.type} not supported yet`;
    response.errors = [`type ${param.type} not supported yet`];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: (
    response: JsonResponseType,
    param: NodeUrlParam,
  ) => {
    response.node_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_DURATION]: (
    response: JsonResponseType,
    param: DurationParam,
  ) => {
    response.duration = param.duration;
  },

  [OUTPUT_EVENTS.OUTPUT_START_TIME]: (
    response: JsonResponseType,
    param: StartTimeParam,
  ) => {
    response.start_time = param.date;
  },

  [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: (
    response: JsonResponseType,
    param: ResultUrlParam,
  ) => {
    response.result_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_RETRIVE_JOB_COMMAND]: (
    response: JsonResponseType,
    param: RetriveJobCommandParam,
  ) => {},

  [OUTPUT_EVENTS.OUTPUT_HEADER_LOGO]: (
    response: JsonResponseType,
    param: OutputHeaderLogoParam,
  ) => {},

  [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: (
    response: JsonResponseType,
    param: JobExecutionParam,
  ) => {
    let execution = {} as {
      operationId: string | null;
      duration: number;
      logs: string[];
      exitCode?: number | null;
      status?: string;
    };

    execution.logs = [];

    for (const log of param.opState.logs) {
      const sanitizedLog = log.log ?? '';
      execution.logs.push(sanitizedLog);
    }

    execution.operationId = param.opState.operationId;
    execution.duration =
      (param.opState.endTime! - param.opState.startTime!) / 1000;

    if (param.opState.status) {
      execution.exitCode = param.opState.exitCode;
      execution.status = param.opState.status;
    }

    if (!response.executions) {
      response.executions = [];
    }

    response.executions.push(execution);
  },
};
