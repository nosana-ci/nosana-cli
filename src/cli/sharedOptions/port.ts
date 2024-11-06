import { Option } from 'commander';

export const portOption = new Option(
  '-p, --port <api-port>',
  'api port to run on',
).default(5001);
