import { Command } from 'commander';

import { validateJob } from './action.js';

export const validateJobCommand = new Command('validate')
  .description('Validate a Nosana Job Definition')
  .argument('Path or Url to Job Definition')
  .action(validateJob);
