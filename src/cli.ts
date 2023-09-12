#!/usr/bin/env node
import figlet from 'figlet';
import { Command, Option } from 'commander';
import { run, get, setSDK } from './cli/index.js';
const program = new Command();

const VERSION = '0.1.0';
console.log(figlet.textSync('Nosana'));

program
  .name('nosana')
  .description('Nosana CLI')
  .version(VERSION)
  .configureHelp({ showGlobalOptions: true })
  .hook('preAction', async (thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    await setSDK(opts.network, opts.wallet);
  })
  .addOption(
    new Option('-n, --network <network>', 'network to run on').default(
      'devnet',
    ),
  )
  .addOption(
    new Option('-w, --wallet <wallet>', 'path to wallet private key').default(
      './nosana_key.json',
    ),
  );

program
  .command('run')
  .description('Create a job to run by Nosana Runners')
  .argument('[command...]', 'command to run')
  .addOption(
    new Option('-i, --image <image>', 'docker image to use').default('ubuntu'),
  )
  .addOption(new Option('--f, --file [path]', 'file with the JSON flow'))
  .addOption(new Option('--raw', 'display raw json job and result'))
  .addOption(
    new Option('--completed', 'wait for job to be completed and show result'),
  )
  .action(run);

program
  .command('get')
  .description('Get a job and display result')
  .argument('<job>', 'job address')
  .addOption(new Option('--raw', 'display raw json job and result'))
  .addOption(
    new Option('--completed', 'wait for job to be completed and show result'),
  )
  .action(get);

async function startCLI() {
  await program.parseAsync(process.argv);
}

startCLI();
