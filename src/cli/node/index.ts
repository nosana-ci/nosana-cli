import { Command, program } from 'commander';

import { joinTestGridCommand } from './joinTestGrid/command.js';
import { runNodeCommand } from './run/command.js';
import { startNodeCommand } from './start/command.js';
import { viewNodeCommand } from './view/command.js';
import { nodePruneCommand } from './prune/command.js';

export const nodeCommand: Command = program
  .command('node')
  .addCommand(joinTestGridCommand)
  .addCommand(nodePruneCommand)
  .addCommand(runNodeCommand)
  .addCommand(startNodeCommand)
  .addCommand(viewNodeCommand);
