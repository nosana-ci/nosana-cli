import { OUTPUT_EVENTS } from "../outputEvents.js";

export const jsonOutputEventHandlers = {
  [OUTPUT_EVENTS.READ_KEYFILE]: (response: any, param: any) => {
    response.keypair_path = param.keyfile;
  },


  [OUTPUT_EVENTS.CREATE_KEYFILE]: (response: any, param: any) => {
    response.keypair_path = param.keyfile;
  },


  [OUTPUT_EVENTS.OUTPUT_BALANCES]: (response: any, param: any) => {
    response.balances = {
      SOL: `${param.sol} SOL`,
      NOS: `${param.nos} NOS`,
    };
  },


  [OUTPUT_EVENTS.OUTPUT_NETWORK]: (response: any, param: any) => {
    response.network = param.network;
  },


  [OUTPUT_EVENTS.OUTPUT_WALLET]: (response: any, param: any) => {
    response.wallet = param.publicKey;
  },


  [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: (response: any, param: any) => {
    response.ipfs_uploaded = param.ipfsHash;
  },


  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: (response: any, param: any) => {
    response.service_url = param.url;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: (response: any, param: any) => {
    response.job_url = param.job_url;
  },


  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: (response: any, param: any) => {
    response.json_flow_url = param.json_flow_url;
  },


  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: (response: any, param: any) => {
    response.market_url = param.market_url;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: (response: any, param: any) => {
    response.price = `${param.price} NOS/s`;
  },


  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: (response: any, param: any) => {
    response.total_cost = `${param.cost} NOS/s`;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: (response: any, param: any) => {
    response.status = param.status;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: (response: any, param: any) => {
    response.job_posting = {
      market_id: param.market_address,
      price_per_second: `${param.price} NOS/s`,
      total_cost: `${param.total} NOS`,
    };
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: (response: any, param: any) => {
    response.job_posting = {
      transaction_id: param.tx,
      ...response.job_posting,
    };
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: (response: any, param: any) => {
    response.msg = 'Job Definition validation failed';
    response.errors = param;
    throw response;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: (response: any, param: any) => {
    response.msg = "Couldn't post job";
    response.errors = [param];
    throw response;
  },


  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: (response: any, param: any) => {
    response.msg = `Minimum of '0.005' SOL needed: SOL available ${param.sol}`;
    response.errors = [`Minimum of '0.005' SOL needed: SOL available ${param.sol}`];
    throw response;
  },


  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: (response: any, param: any) => {
    response.msg = `Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`;
    response.errors = [`Not enough NOS: NOS available ${param.nosBalance}, NOS needed: ${param.nosNeeded}`];
    throw response;
  },

  
  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: (response: any, param: any) => {
    response.node_url = param.url;
  },


  [OUTPUT_EVENTS.OUTPUT_DURATION]: (response: any, param: any) => {
    response.duration = param.duration;
  },


  [OUTPUT_EVENTS.OUTPUT_START_TIME]: (response: any, param: any) => {
    response.start_time = param.date;
  },


  [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: (response: any, param: any) => {
    response.result_url = param.url;
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_LOG_INTRO]: (response: any, param: any) => {},

  
  [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: (response: any, param: any) => {
    let execution = {} as {
      operationId: string;
      duration: number;
      logs: any[];
      exitCode?: number;
      status?: string;
    };

    execution.logs = []

    for (const log of param.opState.logs) {
      const sanitizedLog = log.log.endsWith('\n') ? log.log.slice(0, -1) : log.log;
      execution.logs.push(sanitizedLog)
    }

    execution.operationId = param.opState.operationId;
    execution.duration = (param.opState.endTime! - param.opState.startTime!) / 1000;
    
    if (param.opState.status) {
      execution.exitCode = param.opState.exitCode
      execution.status = param.opState.status
    }

    if (!response.executions) {
      response.executions = [];
    }

    response.executions.push(execution)
  },
};
