import { Command } from 'commander';
import { getSDK } from '../../services/sdk.js';
import { type Client } from '@nosana/sdk';

export async function getAddress(
  options: {
    [key: string]: any;
  },
  cmd: Command,
) {
  const nosana: Client = getSDK();
}
