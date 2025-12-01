import chalk from 'chalk';

const WSL_QUEUE_BLOCK_DATE = new Date('2025-12-15T00:00:00Z');

export function isWSLHost(systemEnvironment: string): boolean {
  if (!systemEnvironment) return false;
  return systemEnvironment.toLowerCase().includes('wsl');
}

export function isWSLBlockActive(): boolean {
  return new Date() >= WSL_QUEUE_BLOCK_DATE;
}

export function displayWSLWarning(): void {
  console.log('');
  console.log(
    chalk.bgYellow.black.bold(' ⚠️  WSL DEPRECATION WARNING '),
  );
  console.log('');
  console.log(
    chalk.yellow(
      'WSL hosts are being removed from the Nosana network.',
    ),
  );
  console.log('');
  console.log(
    chalk.yellow(
      `• ${chalk.bold('December 15, 2025')}: WSL hosts will be blocked from joining the queue`,
    ),
  );
  console.log(
    chalk.yellow(
      `• ${chalk.bold('January 15, 2026')}: Premium market keys for WSL hosts will be revoked`,
    ),
  );
  console.log('');
  console.log(
    chalk.yellow(
      'Please migrate to a native Linux installation to continue participating in the network.',
    ),
  );
  console.log('');
}

export function displayWSLBlockMessage(): void {
  console.log('');
  console.log(
    chalk.bgRed.white.bold(' 🚫 WSL HOST BLOCKED '),
  );
  console.log('');
  console.log(
    chalk.red(
      `WSL hosts have been blocked from the queue since ${chalk.bold('December 15, 2025')}.`,
    ),
  );
  console.log(
    chalk.red(
      `Premium market keys for WSL hosts will be revoked on ${chalk.bold('January 15, 2026')}.`,
    ),
  );
  console.log('');
  console.log(
    chalk.red(
      'Please migrate to a native Linux installation to continue participating in the network.',
    ),
  );
  console.log('');
}

export class WSLBlockedError extends Error {
  constructor() {
    super('WSL hosts are no longer allowed to join the queue');
    this.name = 'WSLBlockedError';
  }
}

/**
 * Check WSL status and handle warning/blocking
 * 
 * @param systemEnvironment - The system_environment value from specs
 * @throws WSLBlockedError if WSL host and block date has passed
 */
export function checkWSLStatus(systemEnvironment: string): void {
  if (!isWSLHost(systemEnvironment)) {
    return;
  }

  if (isWSLBlockActive()) {
    displayWSLBlockMessage();
    throw new WSLBlockedError();
  }

  displayWSLWarning();
}

