import {
  BalanceLowParam,
  BalanceParam,
  DurationParam,
  JobNotFoundErrorParam,
  JobPostedErrorParam,
  JobStatusParam,
  JobUrlParam,
  JsonFlowTypeErrorParam,
  KeyfileParam,
  MarketUrlParam,
  NetworkParam,
  NodeUrlParam,
  NosBalanceLowParam,
  OUTPUT_EVENTS,
  StartTimeParam,
  TotalCostParam,
  ErrorParam,
  WalletParam,
  RetriveJobCommandParam,
  ValidationErrorParam,
  OutputHeaderLogoParam,
  ServiceUrlParam,
} from '../outputEvents.js';
import { OutputEventParams } from '../outputEvents.js';
import chalk from 'chalk';
import { colors } from '../../../../generic/utils.js';
import figlet from 'figlet';

type EventHandler<T extends keyof OutputEventParams> = (
  param: OutputEventParams[T],
) => void;

type OutputEventHandlers = {
  [K in keyof OutputEventParams]: EventHandler<K>;
};

function mapToDoNothingFunction(events: Array<keyof OutputEventHandlers>) {
  return events.reduce((handlers, event) => {
    handlers[event] = () => {};
    return handlers;
  }, {} as OutputEventHandlers);
}

export const textOutputEventHandlers: OutputEventHandlers = {
  /**
   * This is where we dump the event that you want to do nothing
   * this is so you do not forget to integrate them and create error
   */
  ...mapToDoNothingFunction([
    OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED,
    OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL,
    OUTPUT_EVENTS.OUTPUT_JOB_PRICE,
    OUTPUT_EVENTS.OUTPUT_JOB_POSTING,
    OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX,
    OUTPUT_EVENTS.OUTPUT_RESULT_URL,
    OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION,
  ]),
  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: (param: ServiceUrlParam) => {
    console.log(
      chalk.cyan(`Service will be exposed at ${chalk.bold(`${param.url}`)}`),
    );
  },
  [OUTPUT_EVENTS.READ_KEYFILE]: (param: KeyfileParam) => {
    console.log(
      `Reading keypair from ${colors.CYAN}${param.keyfile}${colors.RESET}\n`,
    );
  },
  [OUTPUT_EVENTS.CREATE_KEYFILE]: (param: KeyfileParam) => {
    console.log(
      `Creating new keypair and storing it in ${colors.CYAN}${param.keyfile}${colors.RESET}\n`,
    );
  },
  [OUTPUT_EVENTS.OUTPUT_BALANCES]: (param: BalanceParam) => {
    console.log(`SOL balance:\t${colors.GREEN}${param.sol} SOL${colors.RESET}`);
    console.log(`NOS balance:\t${colors.GREEN}${param.nos} NOS${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_NETWORK]: (param: NetworkParam) => {
    console.log(`Network:\t${colors.GREEN}${param.network}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_WALLET]: (param: WalletParam) => {
    console.log(`Wallet:\t\t${colors.GREEN}${param.publicKey}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: (param: JobUrlParam) => {
    console.log(`Job:\t\t${colors.BLUE}${param.job_url}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: (param: MarketUrlParam) => {
    console.log(`Market:\t\t${colors.BLUE}${param.market_url}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: (param: TotalCostParam) => {
    console.log(`Total Costs:\t${colors.CYAN}${param.cost} NOS${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: (param: JobStatusParam) => {
    console.log(
      `Status:\t\t${param.status === 'COMPLETED' ? colors.GREEN : colors.CYAN}${
        param.status
      }${colors.RESET}`,
    );
  },
  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: (
    param: ValidationErrorParam,
  ) => {
    console.error(param.error);
    throw new Error(chalk.red.bold('Job Definition validation failed'));
  },
  [OUTPUT_EVENTS.OUTPUT_FAILED_TO_FETCH_MARKETS_ERROR]: (param: ErrorParam) => {
    throw new Error(`Failed to fetch market \n${param.error.message}`);
  },
  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: (param: JobPostedErrorParam) => {
    console.error(chalk.red("Couldn't post job"));
    throw param;
  },
  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: (param: BalanceLowParam) => {
    throw new Error(
      chalk.red(
        `Minimum of ${chalk.bold(
          '0.005',
        )} SOL needed: SOL available ${chalk.bold(param.sol)}`,
      ),
    );
  },
  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: (param: NosBalanceLowParam) => {
    throw new Error(
      chalk.red(
        `Not enough NOS: NOS available ${chalk.bold(
          param.nosBalance,
        )}, NOS needed: ${chalk.bold(param.nosNeeded)}`,
      ),
    );
  },
  [OUTPUT_EVENTS.OUTPUT_AIRDROP_REQUEST_FAILED_ERROR]: (param: ErrorParam) => {
    throw new Error('Couldnt airdrop tokens to your address');
  },
  [OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND]: (param: JobNotFoundErrorParam) => {
    console.error(
      `${colors.RED}Could not retrieve job\n${colors.RESET}`,
      param.error,
    );
  },
  [OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT]: () => {
    console.log(`${colors.RED}Cannot log results${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR]: (
    param: ErrorParam,
  ) => {
    throw new Error('artifact support coming soon!');
  },
  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR]: (
    param: JsonFlowTypeErrorParam,
  ) => {
    throw new Error(`type ${param.type} not supported yet`);
  },
  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: (param: NodeUrlParam) => {
    console.log(`Node:\t\t${colors.BLUE}${param.url}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_DURATION]: (param: DurationParam) => {
    console.log(
      `Duration:\t${colors.CYAN}${param.duration} seconds${colors.RESET}`,
    );
  },
  [OUTPUT_EVENTS.OUTPUT_START_TIME]: (param: StartTimeParam) => {
    console.log(`Start Time:\t${colors.CYAN}${param.date}${colors.RESET}`);
  },
  [OUTPUT_EVENTS.OUTPUT_RETRIVE_JOB_COMMAND]: (
    param: RetriveJobCommandParam,
  ) => {
    console.log(
      `\nrun ${colors.CYAN}nosana job get ${param.job} --network ${param.network}${colors.RESET} to retrieve job and result`,
    );
  },
  [OUTPUT_EVENTS.OUTPUT_HEADER_LOGO]: (param: OutputHeaderLogoParam) => {
    console.log(figlet.textSync(param.text));
  },
};
