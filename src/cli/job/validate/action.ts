import fs from 'fs';
import { type JobDefinition, validateJobDefinition } from '@nosana/sdk';
import chalk from 'chalk';

export async function validateJob(path: string) {
  let jobDefinition: JobDefinition;

  if (path.startsWith('http')) {
    try {
      const response = await fetch(path);
      jobDefinition = await response.json();
    } catch {
      throw new Error('Failed to fetch remote job definition.');
    }
  } else {
    jobDefinition = JSON.parse(fs.readFileSync(path, 'utf8'));
  }

  const validation = validateJobDefinition(jobDefinition);

  if (!validation.success) {
    console.log(chalk.red('Invalid Job Definition.'));
    console.group(validation.errors);
    return;
  }

  console.log(chalk.green('Valid Job Definition.'));
}
