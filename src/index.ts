#!/usr/bin/env node
import figlet from 'figlet';
import { Command, Option } from 'commander';
import { setSDK } from './services/sdk.js';
import { run, getJob, download, upload } from './cli/job/index.js';
import { view, startNode, startTestNode, runJob } from './cli/node/index.js';
const program = new Command();

const VERSION = '0.2.0';
console.log(figlet.textSync('Nosana'));

program
  .name('nosana')
  .description('Nosana CLI')
  .version(VERSION)
  .configureHelp({ showGlobalOptions: true })
  .hook('preAction', async (thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    let market = opts.market;

    await setSDK(
      opts.network,
      opts.rpc,
      market,
      opts.wallet,
      actionCommand.opts().airdrop,
    );
  })
  .addOption(
    new Option('-n, --network <network>', 'network to run on')
      .default('devnet')
      .choices(['devnet', 'mainnet']),
  )
  .addOption(new Option('--rpc <url>', 'RPC node to use'))
  .addOption(
    new Option('--log <logLevel>', 'Log level')
      .default('info')
      .choices(['info', 'none', 'debug', 'trace']),
  );

const job = program.command('job');
job
  .command('run')
  .description('Create a job to run by Nosana Runners')
  .argument('[command...]', 'command to run')
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(new Option('--gpu', 'enable GPU on node'))
  .addOption(
    new Option(
      '-o, --output <path>',
      'specify which folder inside the container you want to upload',
    ),
  )
  .addOption(new Option('-m, --market <market>', 'market to use'))
  .addOption(
    new Option('-w, --wallet <wallet>', 'path to wallet private key').default(
      '~/.nosana/nosana_key.json',
    ),
  )
  .addOption(new Option('--wasm <url>', 'wasm url to run'))
  .addOption(new Option('--type <type>', 'type to run').default('docker'))
  .addOption(
    new Option('-i, --image <image>', 'docker image to use').default('ubuntu'),
  )
  .addOption(new Option('-f, --file [path]', 'file with the JSON flow'))
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(
    new Option('--download', 'download external artifacts (implies --wait)'),
  )
  .action(run);

job
  .command('get')
  .description('Get a job and display result')
  .argument('<job>', 'job address')
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path (implies --wait)',
    ),
  )
  // @ts-ignore
  .action(getJob);

job
  .command('upload')
  .description('Upload a file to IPFS')
  .argument('<path>', 'file to upload')
  .action(upload);

job
  .command('download')
  .description('Download an external artifact from IPFS to specified path')
  .argument('<ipfs>', 'ipfs hash')
  .argument('[path]', 'local path to store downloaded artifact')
  .action(download);

const node = program.command('node');
node
  .command('view')
  .argument('<node>', 'node address')
  .description('View Nosana Node')
  .action(view);

node
  .command('start')
  .argument('<market>', 'market address')
  .addOption(
    new Option('--provider <provider>', 'provider used to run the job')
      .choices(['docker'])
      .default('docker'),
  )
  .addOption(
    new Option('-w, --wallet <wallet>', 'path to wallet private key').default(
      '~/.nosana/nosana_key.json',
    ),
  )
  .addOption(
    new Option('--podman <URI>', 'Podman connection URI').default(
      'http://localhost:8080',
    ),
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
      .choices(['docker'])
      .default('docker'),
  )
  .addOption(
    new Option('--podman <URI>', 'Podman connection URI').default(
      'http://localhost:8080',
    ),
  )
  .description('Run Job Definition File')
  .action(runJob);
node
  .command('test')
  .argument('<market>', 'market address')
  .addOption(
    new Option('--provider <provider>', 'provider used to run the job')
      .choices(['docker'])
      .default('docker'),
  )
  .addOption(
    new Option('-w, --wallet <wallet>', 'path to wallet private key').default(
      '~/.nosana/nosana_key.json',
    ),
  )
  .addOption(
    new Option('--podman <URI>', 'Podman connection URI').default(
      'http://localhost:8080',
    ),
  )
  .description('Start Nosana Test Node')
  .action(startTestNode);

async function startCLI() {
  try {
    await program.parseAsync(process.argv);
  } catch (e: any) {
    const logLevel = program.getOptionValue('log');
    if (logLevel === 'debug') {
      console.error(e.message ? e.message : e);
    } else if (logLevel === 'trace') {
      console.error(e);
    }
    process.exit(1);
  }
}

startCLI();
