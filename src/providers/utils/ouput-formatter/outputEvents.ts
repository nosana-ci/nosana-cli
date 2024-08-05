import { OpState } from "../../Provider.js";

export const OUTPUT_EVENTS = {
  READ_KEYFILE: 'READ_KEYFILE',
  CREATE_KEYFILE: 'CREATE_KEYFILE',
  OUTPUT_JOB_URL: 'OUTPUT_JOB_URL',
  OUTPUT_JSON_FLOW_URL: 'OUTPUT_JSON_FLOW_URL',
  OUTPUT_MARKET_URL: 'OUTPUT_MARKET_URL',
  OUTPUT_JOB_PRICE: 'OUTPUT_JOB_PRICE',
  OUTPUT_JOB_STATUS: 'OUTPUT_JOB_STATUS',
  OUTPUT_JOB_POSTED_ERROR: 'OUTPUT_JOB_POSTED_ERROR',
  OUTPUT_JOB_POSTING: 'OUTPUT_JOB_POSTING',
  OUTPUT_NETWORK: 'OUTPUT_NETWORK',
  OUTPUT_BALANCES: 'OUTPUT_BALANCES',
  OUTPUT_WALLET: 'OUTPUT_WALLET',
  OUTPUT_IPFS_UPLOADED: 'OUTPUT_IPFS_UPLOADED',
  OUTPUT_SERVICE_URL: 'OUTPUT_SERVICE_URL',
  OUTPUT_JOB_NOT_FOUND: 'OUTPUT_JOB_NOT_FOUND',
  OUTPUT_CANNOT_LOG_RESULT: 'OUTPUT_CANNOT_LOG_RESULT',
  OUTPUT_JOB_VALIDATION_ERROR: 'OUTPUT_JOB_VALIDATION_ERROR',
  OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR: 'OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR',
  OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR: 'OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR',
  OUTPUT_SOL_BALANCE_LOW_ERROR: 'OUTPUT_SOL_BALANCE_LOW_ERROR',
  OUTPUT_NOS_BALANCE_LOW_ERROR: 'OUTPUT_NOS_BALANCE_LOW_ERROR',
  OUTPUT_AIRDROP_REQUEST_FAILED_ERROR: 'OUTPUT_AIRDROP_REQUEST_FAILED_ERROR',
  OUTPUT_JOB_POSTED_TX: 'OUTPUT_JOB_POSTED_TX',
  OUTPUT_NODE_URL: 'OUTPUT_NODE_URL',
  OUTPUT_DURATION: 'OUTPUT_DURATION',
  OUTPUT_START_TIME: 'OUTPUT_START_TIME',
  OUTPUT_RESULT_URL: 'OUTPUT_RESULT_URL',
  OUTPUT_JOB_LOG_INTRO: 'OUTPUT_JOB_LOG_INTRO',
  OUTPUT_JOB_EXECUTION: 'OUTPUT_JOB_EXECUTION',
  OUTPUT_TOTAL_COST: 'OUTPUT_TOTAL_COST',
} as const;

export type OutputEvent = (typeof OUTPUT_EVENTS)[keyof typeof OUTPUT_EVENTS];

// Define parameter types
export type KeyfileParam = { keyfile: string };
export type BalanceParam = { sol: number; nos: string };
export type NetworkParam = { network: string };
export type WalletParam = { publicKey: string };
export type IpfsParam = { ipfsHash: string };
export type ServiceUrlParam = { url: string };
export type JobUrlParam = { job_url: string };
export type JsonFlowUrlParam = { json_flow_url: string };
export type MarketUrlParam = { market_url: string };
export type JobPriceParam = { price: string };
export type JobStatusParam = { status: string };
export type JobPostingParam = { market_address: string; price: number; total: string };
export type TotalCostParam = { cost: number };
export type TxParam = { tx: string };
export type ErrorParam = { error: any};
export type BalanceLowParam = { sol: string };
export type NosBalanceLowParam = { nosBalance: string; nosNeeded: string };
export type JobPostedErrorParam = { error: any };
export type JsonFlowTypeErrorParam = { type: string };
export type JobNotFoundErrorParam = { error: any };
export type CannotLogResultParam = {};
export type NodeUrlParam = { url: string };
export type DurationParam = { duration: number };
export type StartTimeParam = { date: Date };
export type ResultUrlParam = { url: string };
export type JobLogIntroParam = {};
export type JobExecutionParam = {
  opState: OpState;
};

export type OutputEventParams = {
  [OUTPUT_EVENTS.READ_KEYFILE]: KeyfileParam;
  [OUTPUT_EVENTS.CREATE_KEYFILE]: KeyfileParam;
  [OUTPUT_EVENTS.OUTPUT_BALANCES]: BalanceParam;
  [OUTPUT_EVENTS.OUTPUT_NETWORK]: NetworkParam;
  [OUTPUT_EVENTS.OUTPUT_WALLET]: WalletParam;
  [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: IpfsParam;
  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: ServiceUrlParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: JobUrlParam;
  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: JsonFlowUrlParam;
  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: MarketUrlParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: JobPriceParam;
  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: TotalCostParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: JobStatusParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: JobPostingParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: TxParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: ErrorParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: JobPostedErrorParam;
  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: BalanceLowParam;
  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: NosBalanceLowParam;
  [OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR]: ErrorParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND]: JobNotFoundErrorParam;
  [OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT]: CannotLogResultParam;
  [OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]: ErrorParam;
  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR]: JsonFlowTypeErrorParam;
  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: NodeUrlParam;
  [OUTPUT_EVENTS.OUTPUT_DURATION]: DurationParam;
  [OUTPUT_EVENTS.OUTPUT_START_TIME]: StartTimeParam;
  [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: ResultUrlParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_LOG_INTRO]: JobLogIntroParam;
  [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: JobExecutionParam;
};
