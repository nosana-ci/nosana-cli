import { Client, sleep } from '@nosana/sdk';
import fs from 'node:fs';
import { randomUUID } from 'crypto';
import { IValidation } from 'typia';
import { config } from '../../../generic/config.js';
import { getJob } from '../get/action.js';
import { colors } from '../../../generic/utils.js';
import { getNosBalance, getSDK, getSolBalance } from '../../../services/sdk.js';
import {
  JobDefinition,
  Operation,
  OperationArgsMap,
  OperationType,
  validateJobDefinition,
} from '../../../providers/Provider.js';
import { OUTPUT_EVENTS } from '../../../providers/utils/ouput-formatter/outputEvents.js';
import { outputFormatSelector } from '../../../providers/utils/ouput-formatter/outputFormatSelector.js';
import { clientSelector } from '../../../api/client.js';
import { PublicKey } from '@solana/web3.js';

export async function run(
  command: Array<string>,
  options: {
    [key: string]: any;
  },
) {
  const formatter = outputFormatSelector(options.format);

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
        return formatter.throw(
          OUTPUT_EVENTS.OUTPUT_JSON_FLOW_TYPE_NOT_SUPPORTED_ERROR,
          { type: options.type },
        );
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
    return formatter.throw(
      OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR,
      { error: new Error('artifact support coming soon!') },
    );

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
    return formatter.throw(OUTPUT_EVENTS.OUTPUT_JOB_VALIDATION_ERROR, {
      error: validation.errors,
    });
  }

  const ipfsHash = await nosana.ipfs.pin(json_flow);
  formatter.output(OUTPUT_EVENTS.OUTPUT_IPFS_UPLOADED, {
    ipfsHash: `${nosana.ipfs.config.gateway + ipfsHash}`,
  });

  // check if market is slug or address
  let type: 'slug' | 'address';
  try {
    const regex = new RegExp(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    if (
      new PublicKey(nosana.solana.config.market_address) &&
      nosana.solana.config.market_address.match(regex)
    ) {
      type = 'address';
    } else {
      type = 'slug';
    }
  } catch (e) {
    type = 'slug';
  }

  if (type === 'slug') {
    try {
      const { data: marketResponse, error } = await clientSelector().GET(
        '/api/markets/{id}/',
        {
          params: { path: { id: nosana.solana.config.market_address } },
        },
      );

      if (error) {
        return formatter.throw(
          OUTPUT_EVENTS.OUTPUT_FAILED_TO_FETCH_MARKETS_ERROR,
          { error },
        );
      }

      nosana.solana.config.market_address = marketResponse.address;
    } catch (error) {
      return formatter.throw(
        OUTPUT_EVENTS.OUTPUT_FAILED_TO_FETCH_MARKETS_ERROR,
        { error: error as Error },
      );
    }
  }
  const market = await nosana.jobs.getMarket(
    nosana.solana.config.market_address,
  );

  const solBalance = getSolBalance();
  if (solBalance < 0.005 * 1e9) {
    return formatter.throw(OUTPUT_EVENTS.OUTPUT_SOL_BALANCE_LOW_ERROR, {
      sol: (solBalance / 1e9).toFixed(4),
    });
  }

  // @ts-ignore
  const nosNeeded = (parseInt(market.jobPrice) / 1e6) * market.jobTimeout;
  const nosBalance = getNosBalance();
  if (
    nosNeeded > 0 &&
    (!nosBalance || !nosBalance.uiAmount || nosBalance.uiAmount < nosNeeded)
  ) {
    return formatter.throw(OUTPUT_EVENTS.OUTPUT_NOS_BALANCE_LOW_ERROR, {
      nosBalance: nosBalance?.uiAmount?.toFixed(4) ?? '0',
      nosNeeded: nosNeeded.toFixed(4),
    });
  }

  formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_POSTING, {
    market_address: nosana.solana.config.market_address,
    price: parseInt(market.jobPrice.toString()) / 1e6,
    total: nosNeeded.toFixed(4),
  });

  await nosana.jobs.setAccounts();
  if (market.jobPrice == 0) {
    nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  }
  let response;
  try {
    response = await nosana.jobs.list(ipfsHash);
  } catch (e) {
    return formatter.throw(OUTPUT_EVENTS.OUTPUT_JOB_POSTED_ERROR, {
      error: e as Error,
    });
  }

  formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_POSTED_TX, { tx: response.tx });
  const isExposed =
    json_flow.ops.filter(
      (op: Operation<OperationType>) =>
        op.type === 'container/run' &&
        (op.args as OperationArgsMap['container/run']).expose,
    ).length > 0;
  await sleep(3);
  if (isExposed) {
    formatter.output(OUTPUT_EVENTS.OUTPUT_SERVICE_URL, {
      url: `https://${response.run}.${config.frp.serverAddr}`,
    });
  }
  await getJob(response.job, options, undefined);

  if (!(options.wait || options.download)) {
    formatter.output(OUTPUT_EVENTS.OUTPUT_RETRIVE_JOB_COMMAND, {
      job: response.job,
      network: options.network,
    });
  }
}
