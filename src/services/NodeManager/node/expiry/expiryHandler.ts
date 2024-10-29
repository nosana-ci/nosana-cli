import { Client as SDK, Market, Run } from '@nosana/sdk';
import { PublicKey } from "@solana/web3.js";
import BN from 'bn.js';

export class ExpiryHandler {
    private address: PublicKey;
    public expiryEndTime: number = 0;
    public expiryTimer: NodeJS.Timeout | null = null;
    public warningTimer: NodeJS.Timeout | null = null;
    public resolveExpiryPromise: (() => void) | null = null;
    private onExpireCallback: (() => Promise<unknown>) | null = null;
    constructor(private sdk: SDK) {
        this.address = this.sdk.solana.provider!.wallet.publicKey;
    }

    public init<T>(run: Run, market: Market, onExpireCallback: () => Promise<T>): number {
        this.expiryEndTime = new BN(run.account.time)
            .add(new BN(market.jobTimeout))
            .mul(new BN(1000))
            .toNumber();

        this.onExpireCallback = onExpireCallback;
        this.start();
        return this.expiryEndTime;
    }

    public start() {
        this.startOrResetTimer();
    }

    public stop() {
        if (this.expiryTimer) clearTimeout(this.expiryTimer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        this.expiryTimer = null;
        this.warningTimer = null;
    }

    private startOrResetTimer() {
        this.stop();

        const remainingTime = this.expiryEndTime - Date.now();
        const warningTime = remainingTime - 2 * 60 * 1000; // 2 minutes before expiry

        // Set up the warning timer
        if (warningTime > 0) {
            this.warningTimer = setTimeout(() => {
            }, warningTime);
        }

        // Set up the expiry timer
        this.expiryTimer = setTimeout(async () => {
            this.stop();
            await this.onExpireCallback?.();  // Trigger expiration callback
            this.resolveExpiryPromise?.();
        }, remainingTime);
    }

    public extendExpiryTime(additionalTimeMs: number) {
        this.expiryEndTime += additionalTimeMs;
        this.startOrResetTimer();
    }

    public expired(run: Run, market: Market): boolean {
        const now = Date.now() / 1000;
        const expirationTime = new BN(run.account.time).add(new BN(market.jobTimeout)).toNumber();
        return expirationTime < now;
    }

    public async waitUntilExpired(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.resolveExpiryPromise = resolve;
            this.startOrResetTimer();
        });
    }
}

