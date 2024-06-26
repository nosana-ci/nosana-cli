#!/usr/bin/env -S node --no-warnings
import figlet from 'figlet';
import { Command, Option } from 'commander';
import { setSDK } from './services/sdk.js';
import { run, getJob, download, upload } from './cli/job/index.js';
import { getAddress } from './cli/other/index.js';
import { view, startNode, runJob, runBenchmark } from './cli/node/index.js';
const program: Command = new Command();

const VERSION: string = '0.3.0';
console.log(figlet.textSync('Nosana'));

const rpcOption = new Option('--rpc <url>', 'RPC node to use');
const networkOption = new Option('-n, --network <network>', 'network to run on')
  .default('mainnet')
  .choices(['devnet', 'mainnet']);

const walletOption = new Option(
  '-w, --wallet <wallet>',
  'path to wallet private key',
).default('~/.nosana/nosana_key.json');

program
  .name('nosana')
  .description('Nosana CLI')
  .version(VERSION)
  .configureHelp({ showGlobalOptions: true })
  .hook('preAction', async (thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    let market = opts.market;
    if (opts.network || opts.wallet) {
      await setSDK(
        opts.network,
        opts.rpc,
        market,
        opts.wallet,
        actionCommand.opts().airdrop,
      );
    }
  })
  .addOption(
    new Option('--log <logLevel>', 'Log level')
      .default('debug')
      .choices(['info', 'none', 'debug', 'trace']),
  );

program
  .command('address')
  .addOption(walletOption)
  .description('Print your public key address')
  .action(getAddress);

const job: Command = program.command('job');
job
  .command('post')
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
  .addOption(new Option('-m, --market <market>', 'market to use'))
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
  .action(run);

job
  .command('get')
  .description('Get a job and display result')
  .argument('<job>', 'job address')
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path (implies --wait)',
    ),
  )
  .action(getJob);

job
  .command('upload')
  .description('Upload a file to IPFS')
  .argument('<path>', 'file to upload')
  .addOption(networkOption)
  .addOption(rpcOption)
  .action(upload);

job
  .command('download')
  .description('Download an external artifact from IPFS to specified path')
  .argument('<ipfs>', 'ipfs hash')
  .addOption(networkOption)
  .addOption(rpcOption)
  .argument('[path]', 'local path to store downloaded artifact')
  .action(download);

const node: Command = program.command('node');
node
  .command('view')
  .argument('<node>', 'node address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .description('View Nosana Node')
  .action(view);
node
  .command('start')
  .argument('[market]', 'market address')
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(walletOption)
  .addOption(
    new Option('--provider <provider>', 'provider used to run the job')
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .description('Start Nosana Node')
  .action(startNode);
node
  .command('run')
  .argument('<job-definition-file>', 'Job Definition File')
  .addOption(
    new Option(
      '--provider <provider>',
      'provider used to run the job definition',
    )
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .description('Run Job Definition File')
  .action(runJob);
node
  .command('join-test-grid')
  .addOption(
    new Option(
      '--provider <provider>',
      'provider used to run the job definition',
    )
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .addOption(walletOption)
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(new Option('--no-airdrop', 'no airdrop on devnet'))
  .description('Join Test Grid Devnet Job')
  .action(runBenchmark);

async function startCLI() {
  try {
    await program.parseAsync(process.argv);
  } catch (e: any) {
    const logLevel: string = program.getOptionValue('log');
    if (logLevel === 'debug') {
      console.error(e.message ? e.message : e);
    } else if (logLevel === 'trace') {
      console.error(e);
    }
    process.exit(1);
  }
}

startCLI();
