import { Option } from 'commander';

export const rpcOption = new Option('--rpc <url>', 'RPC node to use');

export const networkOption = new Option(
  '-n, --network <network>',
  'network to run on',
)
  .default('devnet')
  .choices(['devnet', 'mainnet']);

export const walletOption = new Option(
  '-w, --wallet <wallet>',
  'path to wallet private key',
).default('~/.nosana/nosana_key.json');
