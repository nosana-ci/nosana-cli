import { Command } from 'commander';
import { type Client } from '@nosana/sdk';

import { getSDK } from '../../services/sdk.js';

export async function getAddress(
  options: {
    [key: string]: any;
  },
  cmd: Command,
) {
  const nosana: Client = getSDK();
}
