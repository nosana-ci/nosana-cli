#!/usr/bin/env -S node --no-warnings
import pkg from '../package.json' with { type: 'json' };
import { startCLI } from './cli/index.js';

const VERSION: string = pkg.version;

startCLI(VERSION);
