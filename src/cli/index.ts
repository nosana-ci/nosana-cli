import figlet from 'figlet';

import { createNosanaCLI } from './createNosanaCli.js';
import { outputFormatSelector } from "../providers/utils/ouput-formatter/outputFormatSelector.js";
import { OUTPUT_EVENTS } from "../providers/utils/ouput-formatter/outputEvents.js";
import { outputFormatArgumentParser } from "../providers/utils/ouput-formatter/outputFormatArgumentParser.js";

export async function startCLI(version: string) {
  const cli = createNosanaCLI(version);

  try {
    // TODO: little bug here, if the `--format json` is called on a command that does not support it doesn't show the LOGO
    // meaning it processes the args --format before validating the command options.
    outputFormatSelector(outputFormatArgumentParser(process.argv)).output(OUTPUT_EVENTS.OUTPUT_HEADER_LOGO, { text: 'Nosana' })
    await cli.parseAsync(process.argv);  
  } catch (e: any) {
    const logLevel: string = cli.getOptionValue('log');
    if (logLevel === 'debug') {
      console.error(e.message ? e.message : e);
    } else if (logLevel === 'trace') {
      console.error(e);
    }
    process.exit(1);
  } finally {
    outputFormatSelector('').finalize()
  }
}
