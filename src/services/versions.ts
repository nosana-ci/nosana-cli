import chalk from 'chalk';

import pkg from '../../package.json' assert { type: 'json' };
import { clientSelector } from '../api/client.js';

function requiresNewVersion(required: string, current: string): boolean {
  return parseInt(required) > parseInt(current);
}

export async function validateCLIVersion() {
  const client = clientSelector();

  const { data, error } = await client.GET(
    '/api/nodes/minimum-required-version',
    {
      parseAs: 'text',
    },
  );

  if (error || typeof data !== 'string') {
    throw new Error(`Failed to fetch CLI's minium required version.\n${error}`);
  }

  const [current_major, current_minor, current_patch] = pkg.version.split('.');
  const [required_major, required_minor, required_patch] = data.split('.');

  if (
    requiresNewVersion(required_major, current_major) ||
    requiresNewVersion(required_minor, current_minor) ||
    requiresNewVersion(required_patch, current_patch)
  ) {
    console.log(
      chalk.red(
        'A new version of the Nosana cli has been released. Please update your CLI by running npm install -g @nosana/cli.',
      ),
    );
    process.exit(129);
  }
}
