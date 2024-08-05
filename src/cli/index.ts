import figlet from 'figlet';

import { createNosanaCLI } from './createNosanaCli.js';
import { outputFormatSelector } from "../providers/utils/ouput-formatter/OutputFormatter.js";

export async function startCLI(version: string) {
  const cli = createNosanaCLI(version);

  try {
    console.log(figlet.textSync('Nosana'));

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
