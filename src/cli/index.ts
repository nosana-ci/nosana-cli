import { createNosanaCLI } from './createNosanaCli.js';
import { outputFormatSelector } from '../providers/utils/ouput-formatter/outputFormatSelector.js';
import { validateCLIVersion } from '../services/versions.js';

export async function startCLI(version: string) {
  const cli = createNosanaCLI(version);

  try {
    await validateCLIVersion();
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
    outputFormatSelector('').finalize();
  }
}
