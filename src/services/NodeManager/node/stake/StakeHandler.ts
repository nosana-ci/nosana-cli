import { Market, Client as SDK } from '@nosana/sdk';
import { PublicKey, TokenAmount } from '@solana/web3.js';
import { SECONDS_PER_DAY, sleep } from '../../../../generic/utils.js';
import chalk from 'chalk';

type Stake = {
  amount: number;
  duration: number;
};

const NO_STAKE_AMOUNT = 0;

export class StakeHandler {
  private address: PublicKey;
  private stake: Stake = {
    amount: 0,
    duration: 0,
  };

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  async createAta() {
    try {
      await this.sdk.solana.createNosAta(this.address);
    } catch (error) {
      throw new Error(`error creating NOS ATA: ${error}`);
    }
  }

  async nodeHasStakingAccount(): Promise<boolean> {
    try {
      const result = await this.sdk.stake.get(this.address);
      this.stake = {
        amount: result.amount,
        duration: result.duration,
      };
      return true;
    } catch (error: any) {
      if (error.message && error.message.includes('Account does not exist')) {
        return false;
      }
      throw new Error(`error getting node staking account: ${error}`);
    }
  }

  async createStakingAccount(): Promise<boolean> {
    try {
      await this.sdk.stake.create(this.address, 0, 14);
      await sleep(4);
      const result = await this.sdk.stake.get(this.address);
      this.stake = {
        amount: result.amount,
        duration: result.duration,
      };
      return true;
    } catch (error) {
      throw new Error(`error creating or retriveing staking account: ${error}`);
    }
  }

  async topUpStakingAccount(market: Market): Promise<boolean> {
    try {
      const minStakeForMarket = Number(market?.nodeXnosMinimum) || 0;
      const currentStake = Number(this.stake.amount || 0);
      const diff = minStakeForMarket - currentStake;

      await this.sdk.stake.topup(diff);
      await sleep(4);
      const result = await this.sdk.stake.get(this.address);
      this.stake = {
        amount: result.amount,
        duration: result.duration,
      };

      if (Number(this.stake.amount || 0) >= minStakeForMarket) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw new Error(`error creating or retriveing staking account: ${error}`);
    }
  }

  async failTopUpStakingAccount() {
    throw new Error(
      chalk.red(`Cannot enter Market, Insufficient Staked NOS for Market`),
    );
  }

  getStakeAccount(): Stake {
    return this.stake;
  }

  canProceedWithoutStake(
    market: Market,
    nosBalance: TokenAmount | undefined,
  ): boolean {
    const minStakeForMarket = Number(market?.nodeXnosMinimum) || 0;
    const currentStake = Number(this.stake.amount || 0);

    if (
      minStakeForMarket > NO_STAKE_AMOUNT &&
      currentStake < market.nodeXnosMinimum
    ) {
      const diff = minStakeForMarket - currentStake;
      if (
        !nosBalance ||
        !nosBalance.uiAmount ||
        Number(nosBalance.amount) < diff
      ) {
        return false;
      }
    }
    return true;
  }

  getStakeActionInfotext(market: Market): string {
    const minStakeForMarket = Number(market?.nodeXnosMinimum) || 0;
    const currentStake = Number(this.stake.amount || 0);

    let text = `Market requires a minimum of ${
      minStakeForMarket / 1e6
    } NOS to be staked.`;

    if (currentStake > 0) {
      text += ` You currently have ${chalk.bold(
        currentStake / 1e6,
      )} NOS staked.`;
    }

    return text;
  }

  getStakeActionQuerytext(market: Market): string {
    const minStakeForMarket = Number(market?.nodeXnosMinimum) || 0;
    const currentStake = Number(this.stake.amount || 0);
    const diff = minStakeForMarket - currentStake;

    let text = chalk.yellow(
      `Do you want to top up your stake with ${chalk.bold(
        diff / 1e6,
      )} NOS with unstake duration of ${chalk.bold(
        this.stake.duration / SECONDS_PER_DAY,
      )} days? (Y/n):`,
    );

    return text;
  }
}
