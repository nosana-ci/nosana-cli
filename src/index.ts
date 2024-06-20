#!/usr/bin/env node
import figlet from 'figlet';
import { Command, Option } from 'commander';

import { setSDK } from './services/sdk';
import { startCLI } from './cli/startCli';
import { jobCommand } from './cli/commands/job';
import { nodeCommand } from './cli/commands/node';

const program: Command = new Command();

const VERSION: string = '0.3.0';
console.log(figlet.textSync('Nosana'));

program
  .name('nosana')
  .description('Nosana CLI')
  .version(VERSION)
  .configureHelp({ showGlobalOptions: true })
  .hook('preAction', async (thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    let market = opts.market;
    if (opts.network) {
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

program.addCommand(jobCommand);
program.addCommand(nodeCommand);

startCLI(program);
