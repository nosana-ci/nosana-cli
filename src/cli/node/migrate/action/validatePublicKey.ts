import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';

import { config } from '../../../../generic/config.js';

export async function validatePublicKey(
  publicKey: PublicKey,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${config.backendUrl}/nodes/${publicKey.toString()}/vulnerability-check`,
    );
    const { likelihood } = await response.json();

    return [
      'POTENTIALLY COMPROMISED',
      'LIKELY COMPROMISED',
      'COMPROMISED',
    ].includes(likelihood);
  } catch (error: any) {
    console.error(
      chalk.red(`Failed to fetch node vulnerability check ${error.message}`),
    );
    process.exit(1);
  }
}
