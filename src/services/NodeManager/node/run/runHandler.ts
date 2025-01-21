import { Run, Client as SDK } from '@nosana/sdk';
import { ClientSubscriptionId, PublicKey } from '@solana/web3.js';

export class RunHandler {
  private run: Run | undefined;
  private address: PublicKey;
  private runSubscriptionId?: ClientSubscriptionId;
  private getRunsInterval?: NodeJS.Timeout;

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  public getRun(): Run | undefined {
    return this.run;
  }

  public setRun(run: Run): void {
    this.run = run;
  }

  public clearRun(): void {
    this.run = undefined;
  }

  public async stopRun(): Promise<boolean> {
    if (this.run) {
      try {
        await this.sdk.jobs.quit(this.run!);
      } catch (e: any) {
        return false;
      }
    }
    return true;
  }

  public async checkRun(): Promise<Run | undefined> {
    const runs = await this.sdk.jobs.getRuns([
      {
        memcmp: {
          offset: 40,
          bytes: this.address.toString(),
        },
      },
    ]);

    if (!runs?.length) {
      this.clearRun();
      return this.getRun();
    }

    this.setRun(runs[0]);
    return this.getRun();
  }

  // Start monitoring run status
  public async startRunMonitoring(callback: Function): Promise<Run> {
    return new Promise<Run>(async (resolve, reject) => {
      try {
        await this.sdk.jobs.loadNosanaJobs();
        const jobProgram = this.sdk.jobs.jobs!;
        const runAccountFilter = jobProgram.coder.accounts.memcmp(
          jobProgram.account.runAccount.idlAccount.name,
          undefined,
        );
        const coderFilters = [
          {
            memcmp: {
              offset: runAccountFilter.offset,
              bytes: runAccountFilter.bytes,
            },
          },
          {
            memcmp: {
              offset: 40,
              bytes: this.address.toBase58(), // Convert PublicKey to a string
            },
          },
        ];

        // Set up real-time listener for run status changes
        this.runSubscriptionId =
          this.sdk.jobs.connection!.onProgramAccountChange(
            jobProgram.programId,
            async (event) => {
              const runAccount = jobProgram.coder.accounts.decode(
                jobProgram.account.runAccount.idlAccount.name,
                event.accountInfo.data,
              );
              const run: Run = {
                account: runAccount,
                publicKey: event.accountId,
              };
              resolve(run);
            },
            'confirmed',
            coderFilters,
          );

        // Set interval to check run status every 5 minutes
        this.getRunsInterval = setInterval(async () => {
          let run: Run | undefined;
          try {
            const health = await callback();
            if (!health) {
              reject(new Error('HealthCheck failed'));
            }
            run = await this.checkRun();
            if (run) {
              resolve(run);
            }
          } catch (error) {
            reject(error);
          }
        }, 60000 * 5);

        let run: Run | undefined;
        try {
          run = await this.checkRun();
          if (run) {
            resolve(run);
          }
        } catch (error) {
          reject(error);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop monitoring run status
  public stopRunMonitoring(): void {
    if (this.getRunsInterval) {
      clearInterval(this.getRunsInterval);
      this.getRunsInterval = undefined;
    }
    if (this.runSubscriptionId !== undefined) {
      this.sdk.jobs.connection!.removeProgramAccountChangeListener(
        this.runSubscriptionId,
      );
      this.runSubscriptionId = undefined;
    }
  }

  public async stop(): Promise<void> {
    this.stopRunMonitoring();
    await this.stopRun();
    this.clearRun();
  }
}
