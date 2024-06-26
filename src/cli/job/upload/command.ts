import { Command } from 'commander';

import { upload } from './action.js';
import { networkOption, rpcOption } from '../../sharedOptions/index.js';

export const uploadJobCommand = new Command('upload')
  .description('Upload a file to IPFS')
  .argument('<path>', 'file to upload')
  .addOption(networkOption)
  .addOption(rpcOption)
  .action(upload);
