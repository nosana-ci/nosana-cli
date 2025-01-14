import BN from 'bn.js';
import EventEmitter from 'events';
import { Client as SDK, Run, Job } from '@nosana/sdk';
import { ClientSubscriptionId } from '@solana/web3.js';

import ApiEventEmitter from '../api/ApiEventEmitter.js';

export class ExpiryHandler {
  private jobAddress: string | undefined;
  public expiryEndTime: number = 0;
  public expiryTimer: NodeJS.Timeout | null = null;
  public warningTimer: NodeJS.Timeout | null = null;
  private onExpireCallback: (() => Promise<unknown>) | null = null;
  private extendSubscriptionId?: ClientSubscriptionId;

  private resolving = false;

  constructor(private sdk: SDK) {
    ApiEventEmitter.getInstance().on('stop-job', (id: string) => {
      if (this.jobAddress === id) {
        this.shortenedExpiry();
      }
    });
  }

  public stopExtendMonitoring() {
    if (this.extendSubscriptionId !== undefined) {
      this.sdk.jobs.connection!.removeProgramAccountChangeListener(
        this.extendSubscriptionId,
      );
      this.extendSubscriptionId = undefined;
    }
  }

  public init<T>(
    run: Run,
    job: Job,
    jobstring: string,
    accountEmitter: EventEmitter,
    onExpireCallback: () => Promise<T>,
  ): number {
    this.resolving = false;

    this.jobAddress = jobstring;
    this.expiryEndTime = new BN(run.account.time)
      .add(new BN(job.timeout))
      .mul(new BN(1000))
      .toNumber();

    accountEmitter.on('changed', ({ timeout }) => {
      const newExpiryTime = new BN(run.account.time)
        .add(new BN(timeout))
        .mul(new BN(1000))
        .toNumber();

      if (newExpiryTime != this.expiryEndTime) {
        this.extendExpiryTime(newExpiryTime - this.expiryEndTime);
      }
    });

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
    this.stopExtendMonitoring();
  }

  private startOrResetTimer() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    this.expiryTimer = null;
    this.warningTimer = null;

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

  public expired(run: Run, job: Job): boolean {
    const now = Date.now() / 1000;
    const expirationTime = new BN(run.account.time)
      .add(new BN(job.timeout))
      .toNumber();
    return expirationTime < now;
  }

  public async waitUntilExpired(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.stop();
      resolve();
    });
  }

  private shortenedExpiry() {
    this.expiryEndTime = Date.now();
    this.startOrResetTimer(); // Restart timer with updated expiry time
  }
}
