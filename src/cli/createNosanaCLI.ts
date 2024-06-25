import { Command, Option } from 'commander';

import { jobCommand } from './job';
import { nodeCommand } from './node';
import { setSDK } from '../services/sdk';

export const createNosanaCLI = (version: string) =>
  new Command()
    .name('nosana')
    .description('Nosana CLI')
    .version(version)
    .configureHelp({ showGlobalOptions: true })
    .hook('preAction', async (_, actionCommand) => {
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
    )
    .addCommand(jobCommand)
    .addCommand(nodeCommand);
