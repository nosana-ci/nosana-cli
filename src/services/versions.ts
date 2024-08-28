import chalk from 'chalk';
import { clientSelector } from '../api/client.js';
import { pkg } from '../static/staticsImports.js';

function requiresNewVersion(required: string, current: string): boolean {
  return parseInt(required) > parseInt(current);
}

function exitCleanly() {
  console.log(
    chalk.red(
      'A new version of the Nosana cli has been released. Please update you CLI using npm install @nosana/cli.',
    ),
  );
  process.exit(129);
}

export async function validateCLIVersion() {
  const client = clientSelector();

  try {
    const [current_major, current_minor, current_patch] =
      pkg.version.split('.');
    if (
      parseInt(current_major) === 0 &&
      parseInt(current_minor) === 0 &&
      parseInt(current_patch) === 0
    ) {
      console.warn(chalk.yellow('Running in dev mode, skipping version check'));
      return;
    }
    const { data, error } = await client.GET(
      '/api/nodes/minimum-required-version',
      {
        parseAs: 'text',
      },
    );
    if (error || typeof data !== 'string') {
      throw new Error(`${error}`);
    }

    const [required_major, required_minor, required_patch] = data.split('.');

    // TODO: Refactor into a recurrsive loop
    if (parseInt(required_major) === parseInt(current_major)) {
      if (parseInt(required_minor) === parseInt(current_minor)) {
        if (requiresNewVersion(required_patch, current_patch)) {
          exitCleanly();
        }
      } else {
        if (requiresNewVersion(required_minor, current_minor)) {
          exitCleanly();
        }
      }
    } else {
      if (requiresNewVersion(required_major, current_major)) {
        exitCleanly();
      }
    }
  } catch (error: any) {
    throw new Error(
      `${chalk.red(
        "Failed to fetch CLI's minium required version.",
      )}\n${error}`,
    );
  }
}
