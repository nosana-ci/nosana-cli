import { Command, program } from 'commander';

import { downloadJobCommand } from './download/command.js';
import { getJobCommand } from './get/command.js';
import { postJobCommand } from './post/command.js';
import { uploadJobCommand } from './upload/command.js';

export const jobCommand: Command = program
  .command('job')
  .addCommand(downloadJobCommand)
  .addCommand(getJobCommand)
  .addCommand(postJobCommand)
  .addCommand(uploadJobCommand);
