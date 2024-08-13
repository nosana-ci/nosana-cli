import { Command, Option } from 'commander';

import { run } from './action.js';
import {
  networkOption,
  rpcOption,
  walletOption,
} from '../../sharedOptions/index.js';
import { formatOption } from '../../sharedOptions/format.js';
import { verboseOption } from '../../sharedOptions/verbose.js';

export const postJobCommand = new Command('post')
  .description('Create a job to run by Nosana Runners')
  .argument('[command...]', 'command to run')
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(new Option('--no-airdrop', 'no airdrop on devnet'))
  .addOption(new Option('--gpu', 'enable GPU on node'))
  .addOption(
    new Option(
      '-o, --output <path>',
      'specify which folder inside the container you want to upload',
    ),
  )
  .addOption(
    new Option(
      '-m, --market <market>',
      'market slug or address',
    ).makeOptionMandatory(true),
  )
  .addOption(walletOption)
  .addOption(
    new Option('--type <type>', 'type to run')
      .choices(['container'])
      .default('container'),
  )
  .addOption(
    new Option('-i, --image <image>', 'docker image to use').default('ubuntu'),
  )
  .addOption(new Option('-f, --file <path>', 'file with the JSON flow'))
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path  (implies --wait)',
    ),
  )
  .addOption(formatOption)
  .addOption(verboseOption)
  .action(run);
