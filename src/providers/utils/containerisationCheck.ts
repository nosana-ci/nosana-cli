import chalk from 'chalk';

const CONTAINERIZED_QUEUE_BLOCK_DATE = new Date('2026-03-03T00:00:00Z');

export function isContainerizedBlockActive(): boolean {
  return new Date() >= CONTAINERIZED_QUEUE_BLOCK_DATE;
}

export function displayContainerizedWarning(): void {
  console.log('');
  console.log(chalk.bgYellow.black.bold(' ⚠️ LEGACY NODE START DETECTED '));
  console.log('');
  console.log(
    chalk.yellow(
      'The node software is now required to run within a docker or podman container.',
    ),
  );
  console.log('');
  console.log(
    chalk.yellow(
      `• ${chalk.bold(
        'March 03, 2026',
      )}: hosts that have not yet migrated to containerization will be blocked from joining the queue`,
    ),
  );
  console.log('');
  console.log(
    chalk.yellow(
      'Please use the latest start.sh script to run the node software within a container.',
    ),
  );
  console.log(
    chalk.cyan(
      'bash <(wget -qO- https://nosana.com/start.sh)',
    ),
  );
  console.log('');
}

export function displayContainerizedBlockMessage(): void {
  console.log('');
  console.log(chalk.bgRed.white.bold(' 🚫 LEGACY NODE START BLOCKED '));
  console.log('');
  console.log(
    chalk.red(
      `Non containerized hosts have been blocked from the queue since ${chalk.bold(
        'March 03, 2026',
      )}.`,
    ),
  );
  console.log('');
  console.log(
    chalk.red(
      'Please use the latest start.sh script to run the node software within a container.',
    ),
  );
  console.log(
    chalk.cyan(
      'bash <(wget -qO- https://nosana.com/start.sh)',
    ),
  );
  console.log('');
}

export class ContainerizedBlockedError extends Error {
  constructor() {
    super('Non containerized hosts are no longer allowed to join the queue');
    this.name = 'ContainerizedBlockedError';
  }
}

/**
 * Check Containerized status and handle warning/blocking
 *
 * @throws ContainerizedBlockedError if non-containerized host and block date has passed
 */
export function checkContainerizedStatus(): void {
  if (isContainerizedBlockActive()) {
    displayContainerizedBlockMessage();
    throw new ContainerizedBlockedError();
  }

  displayContainerizedWarning();
}
