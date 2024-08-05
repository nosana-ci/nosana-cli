import chalk from "chalk";
import { colors } from '../../../../generic/utils.js';
import { OUTPUT_EVENTS } from "../outputEvents.js";

export const textOutputEventHandlers = {
  [OUTPUT_EVENTS.READ_KEYFILE]: (param: any) => {
    console.log(
      `Reading keypair from ${colors.CYAN}${param.keyfile}${colors.RESET}\n`,
    );
  },


  [OUTPUT_EVENTS.CREATE_KEYFILE]: (param: any) => {
    console.log(
      `Creating new keypair and storing it in ${colors.CYAN}${param.keyfile}${colors.RESET}\n`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_BALANCES]: (param: any) => {
    console.log(
      `SOL balance:\t${colors.GREEN}${param.sol} SOL${colors.RESET}`,
    );
    console.log(
      `NOS balance:\t${colors.GREEN}${param.nos} NOS${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_NETWORK]: (param: any) => {
    console.log(`Network:\t${colors.GREEN}${param.network}${colors.RESET}`);
  },


  [OUTPUT_EVENTS.OUTPUT_WALLET]: (param: any) => {
    console.log(
      `Wallet:\t\t${colors.GREEN}${param.publicKey}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED]: (param: any) => {
    console.log(
      `ipfs uploaded:\t${colors.BLUE}${param.ipfsHash}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_SERVICE_URL]: (param: any) => {
    console.log(
      chalk.cyan(`Service will be exposed at ${chalk.bold(`${param.url}`)}`),
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_URL]: (param: any) => {
    console.log(`Job:\t\t${colors.BLUE}${param.job_url}${colors.RESET}`);
  },


  [OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL]: (param: any) => {
    console.log(
      `JSON flow:\t${colors.BLUE}${param.json_flow_url}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_MARKET_URL]: (param: any) => {
    console.log(
      `Market:\t\t${colors.BLUE}${param.market_url}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_PRICE]: (param: any) => {
    console.log(
      `Price:\t\t${colors.CYAN}${param.price} NOS/s${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_STATUS]: (param: any) => {
    console.log(
      `Status:\t\t${
        param.status === 'COMPLETED' ? colors.GREEN : colors.CYAN
      }${param.status}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTING]: (param: any) => {
    console.log(
      `posting job to market ${colors.CYAN}${param.market_address}${colors.RESET} for price ${colors.YELLOW}${param.price} NOS/s${colors.RESET} (total: ${param.total} NOS)`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_TOTAL_COST]: (param: any) => {
    console.log(
      `Total Costs:\t${colors.CYAN}${
        param.cost
      } NOS${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX]: (param: any) => {
    console.log(`job posted with tx ${chalk.cyan(param.tx)}!`);
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR]: (param: any) => {
    console.error(param);
    throw new Error(chalk.red.bold('Job Definition validation failed'));
  },


  [OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR]: (param: any) => {
    throw new Error(
      chalk.red(
        `Minimum of ${chalk.bold(
          '0.005',
        )} SOL needed: SOL available ${chalk.bold(param.sol)}`,
      ),
    );
  },


  [OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR]: (param: any) => {
    throw new Error(
      chalk.red(
        `Not enough NOS: NOS available ${chalk.bold(
          param.nosBalance,
        )}, NOS needed: ${chalk.bold(param.nosNeeded)}`,
      ),
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR]: (param: any) => {
    console.error(chalk.red("Couldn't post job"));
    throw param;
  },


  [OUTPUT_EVENTS.OUTPUT_NODE_URL]: (param: any) => {
    console.log(
      `Node:\t\t${colors.BLUE}${param.url}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_DURATION]: (param: any) => {
    console.log(
      `Duration:\t${colors.CYAN}${param.duration} seconds${
        colors.RESET
      }`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_START_TIME]: (param: any) => {
    console.log(
      `Start Time:\t${colors.CYAN}${param.date}${
        colors.RESET
      }`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_RESULT_URL]: (param: any) => {
    console.log(
      `Result:\t\t${colors.BLUE}${param.url}${colors.RESET}`,
    );
  },


  [OUTPUT_EVENTS.OUTPUT_JOB_LOG_INTRO]: (param: any) => {
    console.log('Logs:');
  },

  
  [OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION]: (param: any) => {
    console.log(
      `\n${colors.CYAN}- Executed step ${param.opState.operationId} in ${
        (param.opState.endTime! - param.opState.startTime!) / 1000
      }s${colors.RESET}\n`,
    );

    for (let k = 0; k < param.opState.logs.length; k++) {
      const log = param.opState.logs[k];
      const color = log.type === 'stderr' && param.opState.exitCode ? colors.RED : '';
      const sanitizedLog = log.log.endsWith('\n') ? log.log.slice(0, -1) : log.log;
      console.log(`${color}${sanitizedLog}${colors.RESET}`);
    }

    if (param.opState.status) {
      console.log(
        `\n${
          param.opState.exitCode ? colors.RED : colors.GREEN
        }Exited with status ${param.opState.status} with code ${
          param.opState.exitCode
        } ${colors.RESET}`,
      );
    }
  },
};
