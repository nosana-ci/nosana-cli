import { Option } from 'commander';

export const walletOption = new Option(
  '-w, --wallet <wallet>',
  'path to wallet private key',
).default('~/.nosana/nosana_key.json');
