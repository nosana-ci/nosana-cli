#!/usr/bin/env -S node --no-warnings
import { pkg } from './assertImports.js';
import { startCLI } from './cli/index.js';

const VERSION: string = pkg.version;

startCLI(VERSION);
