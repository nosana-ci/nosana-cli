import { Run, Client as SDK } from "@nosana/sdk";
import { ClientSubscriptionId, PublicKey } from "@solana/web3.js";

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
                await this.sdk.jobs.quit(this.run);
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
    public async startRunMonitoring(
        updateCallback: (run: Run) => Promise<void>,
    ): Promise<void> {
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

        // Set interval to check run status every 5 minutes
        this.getRunsInterval = setInterval(async () => {
            try {
                const run: Run | undefined = await this.checkRun();
                if (run) {
                    await updateCallback(run);
                }
            } catch (e) {
                console.warn('\nCould not check for new runs:', e);
            }
        }, 6000 * 5);
    
        // Set up real-time listener for run status changes
        this.runSubscriptionId = this.sdk.jobs.connection!.onProgramAccountChange(
            jobProgram.programId,
            async (event) => {
                try {
                    const runAccount = jobProgram.coder.accounts.decode(
                        jobProgram.account.runAccount.idlAccount.name,
                        event.accountInfo.data,
                    );
                    const run: Run = {
                        account: runAccount,
                        publicKey: event.accountId,
                    };
                    await updateCallback(run); // Notify with the new run
                } catch (e) {
                    console.warn('\nError decoding run account data:', e);
                }
            },
            'confirmed',
            coderFilters,
        );
    }

    // Stop monitoring run status
    public stopRunMonitoring(): void {
        if (this.getRunsInterval) {
            clearInterval(this.getRunsInterval);
            this.getRunsInterval = undefined;
        }
        if (this.runSubscriptionId !== undefined) {
            this.sdk.jobs.connection!.removeProgramAccountChangeListener(this.runSubscriptionId);
            this.runSubscriptionId = undefined;
        }
    }

    public async stop(): Promise<void> {
        this.stopRunMonitoring();
        await this.stopRun();
        this.clearRun()
    }
}
