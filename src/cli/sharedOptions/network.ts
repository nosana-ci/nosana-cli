import { Option } from 'commander';

export const networkOption = new Option(
  '-n, --network <network>',
  'network to run on',
)
  .default('devnet')
  .choices(['devnet', 'mainnet']);
