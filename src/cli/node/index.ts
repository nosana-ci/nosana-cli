import { Command, program } from 'commander';

import { joinCommand } from './join/command.js';
import { runNodeCommand } from './run/command.js';
import { startNodeCommand } from './start/command.js';
import { viewNodeCommand } from './view/command.js';
import { nodePruneCommand } from './prune/command.js';
import { migrateNodeCommand } from './migrate/command.js';

export const nodeCommand: Command = program
  .command('node')
  .addCommand(joinCommand)
  .addCommand(migrateNodeCommand)
  .addCommand(nodePruneCommand)
  .addCommand(runNodeCommand)
  .addCommand(startNodeCommand)
  .addCommand(viewNodeCommand);
