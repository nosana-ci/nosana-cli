import { Option } from 'commander';

export const formatOption = new Option(
  '--format <type>',
  'show result in the specified format',
)
  .choices(['text', 'json'])
  .default('text');
