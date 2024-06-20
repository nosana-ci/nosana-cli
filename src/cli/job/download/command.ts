import { Command } from 'commander';

import { download } from './action';
import { networkOption, rpcOption } from '../../sharedOptions';

export const downloadJobCommand = new Command('download')
  .description('Download an external artifact from IPFS to specified path')
  .argument('<ipfs>', 'ipfs hash')
  .addOption(networkOption)
  .addOption(rpcOption)
  .argument('[path]', 'local path to store downloaded artifact')
  .action(download);
