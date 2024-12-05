import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';

import { config } from '../../../../generic/config.js';

export async function validatePublicKey(publicKey: PublicKey): Promise<{
  isCompromised: boolean;
  isAtRisk: boolean;
  canReimburse: boolean;
}> {
  try {
    const response = await fetch(
      `${config.backendUrl}/nodes/${publicKey.toString()}/vulnerability-check`,
    );
    const { likelihood, canReimburse } = await response.json();

    return {
      isCompromised: ['LIKELY COMPROMISED', 'COMPROMISED'].includes(likelihood),
      isAtRisk: [
        'POTENTIALLY COMPROMISED',
        'LIKELY COMPROMISED',
        'COMPROMISED',
      ].includes(likelihood),
      canReimburse,
    };
  } catch (error: any) {
    console.error(
      chalk.red(`Failed to fetch node vulnerability check ${error.message}`),
    );
    process.exit(1);
  }
}
