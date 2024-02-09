import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import { getSDK } from '../utils/sdk.js';
import { colors } from '../utils/terminal.js';
export async function test(
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  const nosana: Client = getSDK();
  console.log('test');
}
