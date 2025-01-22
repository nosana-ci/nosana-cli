import { createNosanaCLI } from './createNosanaCli.js';
import { outputFormatSelector } from '../providers/utils/ouput-formatter/outputFormatSelector.js';
import { validateCLIVersion } from '../services/versions.js';

export async function startCLI(version: string) {
  const cli = createNosanaCLI(version);

  try {
    await validateCLIVersion();
    await cli.parseAsync(process.argv);
    outputFormatSelector('').finalize();
  } catch (e: any) {
    outputFormatSelector('').finalize();
    console.error(e);
    process.exit();
  }
}
