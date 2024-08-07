import { Command, program } from 'commander';

import { getMarketsCommand } from './list/command.js';
import { getMarketCommand } from './get/command.js';

export const marketCommand: Command = program
  .command('market')
  .addCommand(getMarketsCommand)
  .addCommand(getMarketCommand);
