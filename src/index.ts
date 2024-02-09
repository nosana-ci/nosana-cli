#!/usr/bin/env node
import figlet from 'figlet';
import { Command, Option } from 'commander';
import { setSDK } from './utils/sdk.js';
import { run, get, download, upload } from './job/index.js';
import { test } from './node/index.js';
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
    if (!market) {
      if (opts.gpu) {
        if (opts.network.includes('devnet')) {
          market = '4m2e2nGvem6MorWEzTHqNWsjpweRxWoAfU2u78TdBgGv';
        } else {
          throw new Error('GPU nodes only avaible on devnet for now');
        }
      }
      if (opts.type === 'wasm' || opts.type === 'whisper') {
        if (opts.network.includes('devnet')) {
          market = 'Db9gUpeqYC2FCmHJMxiZX1ncoZXVEABjsaCWfbPzDdXi';
        }
      }
    }
    await setSDK(
      opts.network,
      market,
      opts.wallet,
      actionCommand.opts().airdrop,
    );
  })
  .addOption(
    new Option('-n, --network <network>', 'network to run on').default(
      'devnet',
    ),
  )
  .addOption(new Option('-m, --market <market>', 'market to use'))
  .addOption(
    new Option('-w, --wallet <wallet>', 'path to wallet private key').default(
      '~/nosana_key.json',
    ),
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
  .addOption(new Option('--wasm <url>', 'wasm url to run'))
  .addOption(new Option('--type <type>', 'type to run').default('container'))
  .addOption(
    new Option('-i, --image <image>', 'docker image to use').default('ubuntu'),
  )
  .addOption(new Option('-f, --file [path]', 'file with the JSON flow'))
  .addOption(new Option('--raw', 'display raw json job and result'))
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
  .addOption(new Option('--raw', 'display raw json job and result'))
  .addOption(
    new Option('--wait', 'wait for job to be completed and show result'),
  )
  .addOption(
    new Option(
      '--download [path]',
      'download external artifacts to specified path (implies --wait)',
    ),
  )
  .action(get);

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
  .command('test')
  .description('Test Nosana Node')
  .action(test);

async function startCLI() {
  await program.parseAsync(process.argv);
}

startCLI();
