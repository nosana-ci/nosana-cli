import { createNosanaCLI } from './createNosanaCli.js';
import { outputFormatSelector } from '../providers/utils/ouput-formatter/outputFormatSelector.js';
import { validateCLIVersion } from '../services/versions.js';

export async function startCLI(version: string) {
  const cli = createNosanaCLI(version);
  const isProxyStdio = process.argv.includes('--proxy-stdio');

  try {
    if (!isProxyStdio) {
      await validateCLIVersion();
    }
    await cli.parseAsync(process.argv);
    if (!isProxyStdio) {
      outputFormatSelector('').finalize();
    }
  } catch (e: any) {
    if (!isProxyStdio) {
      outputFormatSelector('').finalize();
    }
    console.error(e);
    process.exit();
  }
}
