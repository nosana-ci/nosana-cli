#!/usr/bin/env -S node --no-warnings
/// <reference path="./global.d.ts" />
import { pkg } from './static/staticsImports.js';
import { startCLI } from './cli/index.js';

const VERSION: string = pkg.version;

startCLI(VERSION);
