import { Client, sleep } from '@nosana/sdk';
import { getNosBalance, getSDK, getSolBalance } from '../../services/sdk.js';
import { getJob } from './get.js';
import fs from 'node:fs';
import { randomUUID } from 'crypto';
import { colors } from '../../generic/utils.js';
import { IValidation } from 'typia';
import { config } from '../../config.js';
import {
  JobDefinition,
  Operation,
  OperationArgsMap,
  validateJobDefinition,
} from '../../providers/Provider.js';
import chalk from 'chalk';

export async function run(
  command: Array<string>,
  options: {
    [key: string]: any;
  },
) {
  if (command.length && options.file) {
    console.error(
      `${colors.YELLOW}WARNING: [command] ignored as file flag is already set${colors.RESET}`,
    );
  }
  const nosana: Client = getSDK();
  let json_flow: { [key: string]: any }; // TODO: add JSON flow type
  if (options.file) {
    json_flow = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  } else {
    switch (options.type) {
      case 'container':
        json_flow = {
          version: '0.1',
          type: 'container',
          meta: {
            trigger: 'cli',
          },
          ops: [
            {
              type: 'container/run',
              id: 'run-from-cli',
              args: {
                cmd: [command.join(' ')],
                image: options.image,
              },
            },
          ],
        };
        break;
      default:
        throw new Error(`type ${options.type} not supported yet`);
    }

    if (options.gpu) {
      if (!json_flow.global) {
        json_flow.global = {};
      }
      json_flow.global.gpu = true;
    }
  }
  const artifactId = 'artifact-' + randomUUID();
  if (options.output) {
    throw new Error('artifact support coming soon!');
    const volumeId = randomUUID() + '-volume';
    const createVolumeOp = {
      op: 'container/create-volume',
      id: 'create-volume-' + volumeId,
      args: {
        name: volumeId,
      },
    };
    for (let i = 0; i < json_flow.ops.length; i++) {
      json_flow.ops[i].args.volumes = [
        {
          name: volumeId,
          dest: options.output,
        },
      ];
    }
    json_flow.ops.unshift(createVolumeOp);
    const cmd = `nosana-node-helper artifact-uploader --job-id ${artifactId} --path ${options.output}`;
    json_flow.ops.push({
      op: 'container/run',
      id: artifactId,
      args: {
        image: 'docker.io/nosana/nosana-node-helper:latest',
        env: {
          SECRETS_MANAGER: nosana.secrets.config.manager,
          SECRETS_TOKEN: ['nosana/secrets-jwt', nosana.secrets.config.manager],
          PINATA_JWT: ['nosana/pinata-jwt'],
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        },
        work_dir: options.output,
        volumes: [
          {
            name: volumeId,
            dest: options.output,
          },
        ],
        cmd: [cmd],
      },
    });
  }
  const validation: IValidation<JobDefinition> =
    validateJobDefinition(json_flow);
  if (!validation.success) {
    console.error(validation.errors);
    throw new Error(chalk.red.bold('Job Definition validation failed'));
  }

  const ipfsHash = await nosana.ipfs.pin(json_flow);
  console.log(
    `ipfs uploaded:\t${colors.BLUE}${nosana.ipfs.config.gateway + ipfsHash}${
      colors.RESET
    }`,
  );
  const market = await nosana.jobs.getMarket(
    nosana.solana.config.market_address,
  );

  const solBalance = getSolBalance();
  if (solBalance < 0.005 * 1e9) {
    throw new Error(
      chalk.red(
        `Minimum of ${chalk.bold(
          '0.005',
        )} SOL needed: SOL available ${chalk.bold(
          (solBalance / 1e9).toFixed(4),
        )}`,
      ),
    );
  }

  // @ts-ignore
  const nosNeeded = (parseInt(market.jobPrice) / 1e6) * market.jobTimeout;
  const nosBalance = getNosBalance();
  if (
    nosNeeded > 0 &&
    (!nosBalance || !nosBalance.uiAmount || nosBalance.uiAmount < nosNeeded)
  ) {
    throw new Error(
      chalk.red(
        `Not enough NOS: NOS available ${chalk.bold(
          nosBalance ? nosBalance.uiAmount?.toFixed(4) : 0,
        )}, NOS needed: ${chalk.bold(nosNeeded.toFixed(4))}`,
      ),
    );
  }

  console.log(
    `posting job to market ${colors.CYAN}${
      nosana.solana.config.market_address
    }${colors.RESET} for price ${colors.YELLOW}${
      // @ts-ignore
      parseInt(market.jobPrice) / 1e6
    } NOS/s${colors.RESET} (total: ${nosNeeded.toFixed(4)} NOS)`,
  );

  await nosana.jobs.setAccounts();
  if (market.jobPrice == 0) {
    nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  }
  let response;
  try {
    response = await nosana.jobs.list(ipfsHash);
  } catch (e) {
    console.error(chalk.red("Couldn't post job"));
    throw e;
  }
  console.log(`job posted with tx ${chalk.cyan(response.tx)}!`);
  const isExposed =
    json_flow.ops.map(
      (op: Operation<any>) =>
        op.type === 'container/run' &&
        (op.args as OperationArgsMap['container/run']).expose,
    ).length > 0;
  await sleep(3);
  if (isExposed) {
    console.log(
      chalk.cyan(
        `Service exposed at ${chalk.bold(
          `https://${response.run}.${config.frp.serverAddr}`,
        )}`,
      ),
    );
  }
  await getJob(response.job, options, undefined);

  if (!(options.wait || options.download)) {
    console.log(
      `\nrun ${colors.CYAN}nosana job get ${response.job} --network ${options.network}${colors.RESET} to retrieve job and result`,
    );
  }
}
