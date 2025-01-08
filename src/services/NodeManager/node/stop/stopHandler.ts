import { Run, Client as SDK, mapJob } from '@nosana/sdk';
import { ClientSubscriptionId, PublicKey } from '@solana/web3.js';

export class StopHandler {
  private address: PublicKey;
  private runSubscriptionId?: ClientSubscriptionId;

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  public startStopHandlerMonitoring(
    jobAddress: string,
    callback: Function,
  ): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await this.sdk.jobs.loadNosanaJobs();
        this.runSubscriptionId = this.sdk.jobs.connection!.onAccountChange(
          new PublicKey(jobAddress),
          async (accountInfo) => {
            const jobAccount = this.sdk.jobs.jobs!.coder.accounts.decode(
              this.sdk.jobs.jobs!.account.jobAccount.idlAccount.name,
              accountInfo.data,
            );
            if (jobAccount.state >= 2) {
              this.stopStopHandlerMonitoring();
              await callback();
              resolve();
            }
          },
          'confirmed',
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop monitoring run status
  public stopStopHandlerMonitoring(): void {
    if (this.runSubscriptionId !== undefined) {
      this.sdk.jobs.connection!.removeProgramAccountChangeListener(
        this.runSubscriptionId,
      );
      this.runSubscriptionId = undefined;
    }
  }

  public async stop(): Promise<void> {
    this.stopStopHandlerMonitoring();
  }
}
