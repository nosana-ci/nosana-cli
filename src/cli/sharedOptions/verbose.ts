import { Option } from 'commander';

export const verboseOption = new Option(
  '--verbose',
  'show more detailed result',
).conflicts(['format']);
