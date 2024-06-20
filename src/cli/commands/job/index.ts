import { Command, program } from 'commander';

import { downloadJobCommand } from './download';
import { getJobCommand } from './get';
import { postJobCommand } from './post';
import { uploadJobCommand } from './upload';

export const jobCommand: Command = program
  .command('job')
  .addCommand(downloadJobCommand)
  .addCommand(getJobCommand)
  .addCommand(postJobCommand)
  .addCommand(uploadJobCommand);
