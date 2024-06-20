import { Command } from 'commander';
import { networkOption, rpcOption } from '../sharedOptions';
import { download } from '../../job';

export const downloadJobCommand = new Command('download')
  .description('Download an external artifact from IPFS to specified path')
  .argument('<ipfs>', 'ipfs hash')
  .addOption(networkOption)
  .addOption(rpcOption)
  .argument('[path]', 'local path to store downloaded artifact')
  .action(download);
