import ora from 'ora';
import chalk from 'chalk';
import { Client as SDK } from '@nosana/sdk';
import { TokenAmount, PublicKey } from '@solana/web3.js';

type Balances = {
  sol: number;
  nos: TokenAmount | undefined;
};

const MINIMUM_SOL_BALANCE = 0.005;
const SOLANA_DECIMAL = 1e9;

export class BalanceHandler {
  private address: PublicKey;

  private balances: Balances = {
    sol: 0,
    nos: undefined,
  };

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  public async balance(): Promise<boolean> {
    try {
      this.balances.sol = await this.sdk.solana.getSolBalance(this.address);
      this.balances.nos = await this.sdk.solana.getNosBalance(this.address);

      return true;
    } catch (error) {
      return false;
    }
  }

  private async waitForSufficentSol() {
    let balancePollingInterval: NodeJS.Timeout;

    return new Promise((resolve) => {
      balancePollingInterval = setInterval(async () => {
        if (await this.balance()) {
          const solBalance = this.balances.sol / SOLANA_DECIMAL;
          if (solBalance > MINIMUM_SOL_BALANCE) {
            resolve(true);
          }
        }
      }, 30000);
    }).finally(() => clearInterval(balancePollingInterval));
  }

  public async check(wait = false): Promise<void> {
    const solBalance = this.balances.sol / SOLANA_DECIMAL;
    if (solBalance < MINIMUM_SOL_BALANCE) {
      const insufficentSolMessage = `SOL balance ${solBalance} should be 0.005 or higher. Send some SOL to your node address ${this.address} `;

      if (!wait) {
        throw new Error(insufficentSolMessage);
      }

      const spinner = ora(chalk.yellow(insufficentSolMessage)).start();
      await this.waitForSufficentSol();
      spinner.succeed();
    }
  }

  public getNosBalance(): TokenAmount | undefined {
    return this.balances.nos;
  }
}
