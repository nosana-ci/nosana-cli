#!/usr/bin/env -S node --no-warnings
import { startCLI } from './cli/index.js';

const VERSION: string = '0.3.0';

startCLI(VERSION);
