import { Client as SDK, Market, Run, Job } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import ApiEventEmitter from '../api/ApiEventEmitter.js';
import { jobEmitter } from '../job/jobHandler.js';

export class ExpiryHandler {
  private address: PublicKey;
  private jobAddress: string | undefined;
  public expiryEndTime: number = 0;
  public expiryTimer: NodeJS.Timeout | null = null;
  public warningTimer: NodeJS.Timeout | null = null;
  private onExpireCallback: (() => Promise<unknown>) | null = null;

  private resolving = false;

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;

    ApiEventEmitter.getInstance().on('stop-job', (id: string) => {
      if (this.jobAddress === id) {
        this.shortenedExpiry();
      }
    });

    // Listen for the job completion event
    jobEmitter.on('run-completed', async (data) => {
      if (!this.resolving) {
        this.resolving = true;
        this.stop();
        await this.onExpireCallback?.(); // Trigger expiration callback
      }
    });
  }

  public init<T>(
    run: Run,
    job: Job,
    market: Market,
    jobstring: string,
    onExpireCallback: () => Promise<T>,
  ): number {
    this.resolving = false;

    this.jobAddress = jobstring;
    this.expiryEndTime = new BN(run.account.time)
      // .add(new BN(job.timeout))
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
    this.jobAddress = undefined;
  }

  private startOrResetTimer() {
    this.stop();

    const remainingTime = this.expiryEndTime - Date.now();
    const warningTime = remainingTime - 2 * 60 * 1000; // 2 minutes before expiry

    // Set up the warning timer
    if (warningTime > 0) {
      this.warningTimer = setTimeout(() => {}, warningTime);
    }

    // Set up the expiry timer
    this.expiryTimer = setTimeout(async () => {
      if (!this.resolving) {
        this.resolving = true;
        this.stop();
        await this.onExpireCallback?.(); // Trigger expiration callback
      }
    }, remainingTime);
  }

  public extendExpiryTime(additionalTimeMs: number) {
    this.expiryEndTime += additionalTimeMs;
    this.startOrResetTimer();
  }

  public expired(run: Run, job: Job, market: Market): boolean {
    const now = Date.now() / 1000;
    const expirationTime = new BN(run.account.time)
      // .add(new BN(job.timeout))
      .add(new BN(market.jobTimeout))
      .toNumber();
    return expirationTime < now;
  }

  public async waitUntilExpired(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.startOrResetTimer();
    });
  }

  private shortenedExpiry() {
    this.expiryEndTime = Date.now();
    this.startOrResetTimer(); // Restart timer with updated expiry time
  }
}
