import { Command, program } from 'commander';

import { downloadJobCommand } from './download/command.js';
import { getJobCommand } from './get/command.js';
import { postJobCommand } from './post/command.js';
import { uploadJobCommand } from './upload/command.js';
import { stopJobCommand } from './stop/command.js';
import { jobServeCommand } from './serve/command.js';
import { extendJobCommand } from './extend/command.js';
import { validateJobCommand } from './validate/command.js';

export const jobCommand: Command = program
  .command('job')
  .addCommand(downloadJobCommand)
  .addCommand(getJobCommand)
  .addCommand(postJobCommand)
  .addCommand(stopJobCommand)
  .addCommand(jobServeCommand)
  .addCommand(extendJobCommand)
  .addCommand(uploadJobCommand)
  .addCommand(validateJobCommand);
