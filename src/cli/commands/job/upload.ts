import { Command } from 'commander';

import { upload } from '../../job';
import { networkOption, rpcOption } from '../sharedOptions';

export const uploadJobCommand = new Command('upload')
  .description('Upload a file to IPFS')
  .argument('<path>', 'file to upload')
  .addOption(networkOption)
  .addOption(rpcOption)
  .action(upload);
