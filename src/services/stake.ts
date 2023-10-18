import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { SolanaManager } from './solana.js';
import * as anchor from '@coral-xyz/anchor';
const { BN } = anchor;
import { PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const SECONDS_PER_DAY = 24 * 60 * 60;

export class Stake extends SolanaManager {
  constructor(...args: any) {
    super(...args);
  }

  /**
   * Create a stake account
   * @param address NOS Token account
   * @param amount amount in whole NOS
   * @param unstakeDays unstake period
   * @returns
   */
  async create(address: PublicKey, amount: number, unstakeDays: number) {
    await this.loadNosanaStake();
    await this.setAccounts();

    const stakeDurationSeconds = unstakeDays * SECONDS_PER_DAY;
    const decimals = 1e6;
    const stakeAmount = amount * decimals;

    try {
      const mint = new PublicKey(this.config.nos_address);
      const ata = await getAssociatedTokenAddress(mint, address);

      const [vault] = await PublicKey.findProgramAddress(
        [utf8.encode('vault'), mint.toBuffer(), address.toBuffer()],
        new PublicKey(this.config.stake_address),
      );

      const [stake] = await PublicKey.findProgramAddress(
        [utf8.encode('stake'), mint.toBuffer(), address.toBuffer()],
        new PublicKey(this.config.stake_address),
      );

      return await this.stake!.methods.stake(
        new BN(stakeAmount),
        new BN(stakeDurationSeconds),
      )
        .accounts({
          ...this.accounts,
          mint,
          user: ata,
          vault: vault,
          stake: stake,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } catch (error) {
      console.error(error);
      throw new Error('Something went wrong while creating stake account');
    }
  }
}
