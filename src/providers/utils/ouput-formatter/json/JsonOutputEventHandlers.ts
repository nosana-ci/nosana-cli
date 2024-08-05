import { BalanceLowParam, BalanceParam, CannotLogResultParam, DurationParam, IpfsParam, JobExecutionParam, JobLogIntroParam, JobNotFoundErrorParam, JobPostedErrorParam, JobPostingParam, JobPriceParam, JobStatusParam, JobUrlParam, JsonFlowTypeErrorParam, JsonFlowUrlParam, KeyfileParam, MarketUrlParam, NetworkParam, NodeUrlParam, NosBalanceLowParam, OUTPUT_EVENTS, ResultUrlParam, ServiceUrlParam, StartTimeParam, TotalCostParam, TxParam, ErrorParam, WalletParam } from "../outputEvents.js";
import { OutputEventParams } from "../outputEvents.js";

type EventHandler<T extends keyof OutputEventParams> = (response: any, param: OutputEventParams[T]) => void;

type OutputEventHandlers = {
  [K in keyof OutputEventParams]: EventHandler<K>;
};

export const jsonOutputEventHandlers: OutputEventHandlers = {
  [OUTPUT_EVENTS.READ_KEYFILE]: (response: any, param: KeyfileParam) => {
    response.keypair_path = param.keyfile;
  },

  [OUTPUT_EVENTS.CREATE_KEYFILE]: (response: any, param: KeyfileParam) => {
    response.keypair_path = param.keyfile;
  },

  [OUTPUT_EVENTS.OUTPUT_BALANCES]: (response: any, param: BalanceParam) => {
    response.balances = {
      SOL: `${param.sol} SOL`,
      NOS: `${param.nos} NOS`,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_NETWORK]: (response: any, param: NetworkParam) => {
    response.network = param.network;
  },

  [OUTPUT_EVENTS.OUTPUT_WALLET]: (response: any, param: WalletParam) => {
    response.wallet = param.publicKey;
  },

  [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: (response: any, param: IpfsParam) => {
    response.ipfs_uploaded = param.ipfsHash;
  },

  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: (response: any, param: ServiceUrlParam) => {
    response.service_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: (response: any, param: JobUrlParam) => {
    response.job_url = param.job_url;
  },

  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: (response: any, param: JsonFlowUrlParam) => {
    response.json_flow_url = param.json_flow_url;
  },

  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: (response: any, param: MarketUrlParam) => {
    response.market_url = param.market_url;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: (response: any, param: JobPriceParam) => {
    response.price = `${param.price} NOS/s`;
  },

  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: (response: any, param: TotalCostParam) => {
    response.total_cost = `${param.cost} NOS/s`;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: (response: any, param: JobStatusParam) => {
    response.status = param.status;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: (response: any, param: JobPostingParam) => {
    response.job_posting = {
      market_id: param.market_address,
      price_per_second: `${param.price} NOS/s`,
      total_cost: `${param.total} NOS`,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: (response: any, param: TxParam) => {
    response.job_posting = {
      transaction_id: param.tx,
      ...response.job_posting,
    };
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: (response: any, param: ErrorParam) => {
    response.msg = 'Job Definition validation failed';
    response.errors = param.error;
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: (response: any, param: JobPostedErrorParam) => {
    response.isError = true;
    response.msg = "Couldn't post job";
    response.errors = [param.error];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: (response: any, param: BalanceLowParam) => {
    response.isError = true;
    response.msg = `Minimum of '0.005' SOL needed: SOL available ${param.sol}`;
    response.errors = [`Minimum of '0.005' SOL needed: SOL available ${param.sol}`];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: (response: any, param: NosBalanceLowParam) => {
    response.isError = true;
    response.msg = `Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`;
    response.errors = [`Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR]: (response: any, param: ErrorParam) => {
    response.isError = true;
    response.msg = 'Couldnt airdrop tokens to your address';
    response.errors = ['Couldnt airdrop tokens to your address'];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND]: (response: any, param: JobNotFoundErrorParam) => {
    response.isError = true;
    response.msg = 'Could not retrieve job';
    response.errors = [param.error];
  },

  [OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT]: (response: any, param: CannotLogResultParam) => {
    response.isError = true;
    response.msg = 'Cannot log results';
    response.errors = ['Cannot log results'];
  },

  [OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]: (response: any, param: ErrorParam) => {
    response.isError = true;
    response.msg = 'artifact support coming soon!';
    response.errors = ['artifact support coming soon!'];
    throw response;
  },
  
  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR]: (response: any, param: JsonFlowTypeErrorParam) => {
    response.isError = true;
    response.msg = `type ${param.type} not supported yet`;
    response.errors = [`type ${param.type} not supported yet`];
    throw response;
  },

  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: (response: any, param: NodeUrlParam) => {
    response.node_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_DURATION]: (response: any, param: DurationParam) => {
    response.duration = param.duration;
  },

  [OUTPUT_EVENTS.OUTPUT_START_TIME]: (response: any, param: StartTimeParam) => {
    response.start_time = param.date;
  },

  [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: (response: any, param: ResultUrlParam) => {
    response.result_url = param.url;
  },

  [OUTPUT_EVENTS.OUTPUT_JOB_LOG_INTRO]: (response: any, param: JobLogIntroParam) => {},

  [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: (response: any, param: JobExecutionParam) => {
    let execution = {} as {
      operationId: string | null;
      duration: number;
      logs: any[];
      exitCode?: number | null;
      status?: string;
    };

    execution.logs = [];

    for (const log of param.opState.logs) {
      const sanitizedLog = log.log?.endsWith('\n') ? log.log.slice(0, -1) : log.log ?? '';
      execution.logs.push(sanitizedLog);
    }

    execution.operationId = param.opState.operationId;
    execution.duration = (param.opState.endTime! - param.opState.startTime!) / 1000;
    
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
