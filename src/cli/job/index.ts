import { Command, program } from 'commander';

import { downloadJobCommand } from './download/command';
import { getJobCommand } from './get/command';
import { postJobCommand } from './post/command';
import { uploadJobCommand } from './upload/command';

export const jobCommand: Command = program
  .command('job')
  .addCommand(downloadJobCommand)
  .addCommand(getJobCommand)
  .addCommand(postJobCommand)
  .addCommand(uploadJobCommand);
