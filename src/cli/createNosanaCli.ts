import { Command, Option } from 'commander';
import { jobCommand } from './job/index.js';
import { nodeCommand } from './node/index.js';
import { setSDK } from '../services/sdk.js';
import { addressCommand } from './address/command.js';
import { marketCommand } from './market/index.js';
import { OUTPUT_EVENTS } from '../providers/utils/ouput-formatter/outputEvents.js';
import { outputFormatArgumentParser } from '../providers/utils/ouput-formatter/outputFormatArgumentParser.js';
import { outputFormatSelector } from '../providers/utils/ouput-formatter/outputFormatSelector.js';

export const createNosanaCLI = (version: string) =>
  new Command()
    .name('nosana')
    .description('Nosana CLI')
    .version(version)
    .configureHelp({ showGlobalOptions: true })
    .hook('preSubcommand', async (_, actionCommand) => {
      outputFormatSelector(
        outputFormatArgumentParser(actionCommand.parent?.args ?? []),
      ).output(OUTPUT_EVENTS.OUTPUT_HEADER_LOGO, { text: 'Nosana' });
    })
    .hook('preAction', async (_, actionCommand) => {
      const opts = actionCommand.optsWithGlobals();
      let market = opts.market;
      if (opts.network || opts.wallet) {
        await setSDK(
          opts.network,
          opts.rpc,
          market,
          opts.wallet,
          actionCommand.opts(),
        );
      }
    })
    .addOption(
      new Option('--log <logLevel>', 'Log level')
        .default('debug')
        .choices(['info', 'none', 'debug', 'trace']),
    )
    .addCommand(jobCommand)
    .addCommand(nodeCommand)
    .addCommand(addressCommand)
    .addCommand(marketCommand);
