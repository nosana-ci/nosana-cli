import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';

import { config } from '../../../../generic/config.js';

export async function validatePublicKey(publicKey: PublicKey): Promise<{
  node: string;
  likelihood: string;
  newNodeAddress: null | string;
  isCompromised: boolean;
  isAtRisk: boolean;
  reimbursementTransaction: null | string;
}> {
  try {
    const response = await fetch(
      `${config.backendUrl}/nodes/${publicKey.toString()}/vulnerability-check`,
    );
    const row = await response.json();
    return {
      ...row,
      isCompromised: ['LIKELY COMPROMISED', 'COMPROMISED'].includes(
        row.likelihood,
      ),
      isAtRisk: [
        'LIKELY SAFE',
        'POTENTIALLY COMPROMISED',
        'LIKELY COMPROMISED',
        'COMPROMISED',
      ].includes(row.likelihood),
    };
  } catch (error: any) {
    console.error(chalk.red(`Failed to fetch node vulnerability check`, error));
    process.exit(1);
  }
}
