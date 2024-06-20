import { Command, program } from 'commander';

import { joinTestGridCommand } from './joinTestGrid';
import { runNodeCommand } from './run';
import { startNodeCommand } from './start';
import { viewNodeCommand } from './view';

export const nodeCommand: Command = program
  .command('node')
  .addCommand(joinTestGridCommand)
  .addCommand(runNodeCommand)
  .addCommand(startNodeCommand)
  .addCommand(viewNodeCommand);
