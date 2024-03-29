import { Client } from '@nosana/sdk';
import { getSDK } from '../../services/sdk.js';
import { getJob } from './get.js';
import { getWAPMUrlForCommandName } from './wapm.js';
import fs from 'node:fs';
import { randomUUID } from 'crypto';
import { colors } from '../../generic/utils.js';

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
  } else if (!command.length && !options.file) {
    throw new Error(
      'error: either specify a [command] or provide a file with the --file flag',
    );
  }
  const nosana: Client = getSDK();
  let json_flow: { [key: string]: any }; // TODO: add JSON flow type
  if (options.file) {
    json_flow = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  } else {
    switch (options.type) {
      case 'docker':
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
      case 'wasm':
        let wasmUrl = options.wasm;
        if (!wasmUrl) {
          wasmUrl = await getWAPMUrlForCommandName(command[0]);
        }
        json_flow = {
          state: {
            'nosana/type': 'wasm',
            'nosana/trigger': 'cli',
          },
          ops: [
            {
              op: 'wasm/run',
              id: 'run-from-cli',
              args: {
                cmds: [{ cmd: command.join(' ') }],
                wasm: wasmUrl,
              },
            },
          ],
        };
        break;
      case 'whisper':
        let audioUrl: string = command[0];
        if (!audioUrl.startsWith('http')) {
          audioUrl =
            nosana.ipfs.config.gateway + (await nosana.ipfs.pinFile(audioUrl));
          console.log(
            `audio file uploaded:\t${colors.BLUE}${audioUrl}${colors.RESET}`,
          );
        }
        json_flow = {
          state: {
            'nosana/type': 'whisper',
            'nosana/trigger': 'cli',
          },
          ops: [
            {
              op: 'whisper/run',
              id: 'run-from-cli',
              args: {
                audio: audioUrl,
              },
            },
          ],
        };
        break;
      default:
        throw new Error(`type ${options.type} not supported yet`);
    }
    if (options.gpu) {
      json_flow.ops[0].args.devices = [{ path: 'nvidia.com/gpu=all' }];
    }
  }
  const artifactId = 'artifact-' + randomUUID();
  if (options.output) {
    if (options.type === 'wasm' || options.type === 'whisper') {
      throw new Error('artifacts not yet supported for this job type');
    }
    const volumeId = randomUUID() + '-volume';
    const createVolumeOp = {
      op: 'container/create-volume',
      id: volumeId,
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
        workdir: options.output,
        volumes: [
          {
            name: volumeId,
            dest: options.output,
          },
        ],
        cmds: [{ cmd }],
      },
    });
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

  console.log(
    `posting job to market ${colors.CYAN}${
      nosana.solana.config.market_address
    }${colors.RESET} for price ${colors.YELLOW}${
      // @ts-ignore
      parseInt(market.jobPrice) / 1e6
    } NOS/s${colors.RESET}`,
  );

  await nosana.jobs.setAccounts();
  if (market.jobPrice == 0) {
    nosana.jobs.accounts!.user = nosana.jobs.accounts!.vault;
  }
  const response = await nosana.jobs.list(ipfsHash);
  console.log('job posted!', response);
  await getJob(response.job, options, undefined, nosana);

  if (!(options.wait || options.download)) {
    console.log(
      `\nrun ${colors.CYAN}nosana get ${response.job}${colors.RESET} to retrieve job and result`,
    );
  }
}
