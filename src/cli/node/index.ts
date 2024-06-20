import { Command, program } from 'commander';

import { joinTestGridCommand } from './joinTestGrid/command';
import { runNodeCommand } from './run/command';
import { startNodeCommand } from './start/command';
import { viewNodeCommand } from './view/command';

export const nodeCommand: Command = program
  .command('node')
  .addCommand(joinTestGridCommand)
  .addCommand(runNodeCommand)
  .addCommand(startNodeCommand)
  .addCommand(viewNodeCommand);
