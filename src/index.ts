#!/usr/bin/env -S node --no-warnings
import { pkg } from './static/staticsImports.js';
import { startCLI } from './cli/index.js';

const VERSION: string = pkg.version;

startCLI(VERSION);
