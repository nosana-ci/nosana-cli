import { Client as SDK, Market, Run } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';

export class MarketHandler {
  private market: Market | undefined;
  private address: PublicKey;
  private checkQueuedInterval?: NodeJS.Timeout; // Interval to check market queue

  private inMarket: boolean = false;

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  public clear(): void {
    this.market = undefined;
  }

  public isInMarket(): boolean {
    return this.inMarket;
  }

  public setInMarket() {
    this.inMarket = true;
  }

  public async check(market: string): Promise<Market> {
    try {
      return await this.sdk.jobs.getMarket(market);
    } catch (error) {
      throw new Error(`Error resolving Market: ${error}`);
    }
  }

  public async stopMarket(): Promise<boolean> {
    if (this.market) {
      try {
        await this.sdk.jobs.stop(this.market.address);
      } catch (e: any) {
        return false;
      }
    }
    return true;
  }

  public async getJobMarket(market: string): Promise<Market> {
    try {
      this.market = await this.sdk.jobs.getMarket(market);
      return this.market;
    } catch (error) {
      throw new Error('market does not exists');
    }
  }

  public getMarket(): Market | undefined {
    return this.market;
  }

  public async setMarket(market: string): Promise<Market> {
    try {
      this.market = await this.sdk.jobs.getMarket(market);
      return this.market;
    } catch (error) {
      throw new Error('market does not exists');
    }
  }

  public async checkQueuedInMarket(): Promise<Market | undefined> {
    let markets = [];

    markets = await this.sdk.jobs.allMarkets();

    for (const market of markets) {
      if (
        market?.queue?.some(
          (e: PublicKey) => e.toString() === this.address.toString(),
        )
      ) {
        this.market = market;
        return this.getMarket();
      }
    }

    return undefined;
  }

  public async join(accessKey?: PublicKey): Promise<Market> {
    if (!this.market) {
      throw new Error('market not defined');
    }
    try {
      await this.sdk.jobs.work(this.market.address, accessKey);
      this.inMarket = true;
    } catch (_) {
      throw new Error('could not join queue');
    }

    return this.market;
  }

  public async refresh(): Promise<Market> {
    return this.setMarket(this.market?.address.toString() as string);
  }

  public async leave(): Promise<void> {
    if (this.market) {
      try {
        await this.sdk.jobs.stop(this.market.address);
      } catch (error) {}
      this.inMarket = false;
    }
  }

  public processMarketQueuePosition(market: Market, isFirst: boolean) {
    const position =
      market.queue.findIndex(
        (e: any) => e.toString() === this.address.toString(),
      ) + 1;
    return {
      position,
      count: market.queue.length,
    };
  }

  public async startMarketQueueMonitoring(
    updateCallback: (market: Market | undefined) => void,
  ): Promise<void> {
    // Ensure no multiple intervals
    this.stopMarketQueueMonitoring();

    try {
      // Perform an immediate check
      const queuedMarketInfo = await this.checkQueuedInMarket();
      updateCallback(queuedMarketInfo);
    } catch (e) {
      console.warn('\nCould not update queue status', e);
    }

    // Check market queue status every 2 minutes
    this.checkQueuedInterval = setInterval(async () => {
      try {
        const queuedMarketInfo = await this.checkQueuedInMarket();
        updateCallback(queuedMarketInfo);
      } catch (e) {
        console.warn('\nCould not update queue status', e);
      }
    }, 60000 * 1);
  }

  // Stop monitoring market queue status
  public stopMarketQueueMonitoring(): void {
    if (this.checkQueuedInterval) {
      clearInterval(this.checkQueuedInterval);
      this.checkQueuedInterval = undefined; // Clean up reference
    }
  }

  public async stop(): Promise<void> {
    this.stopMarketQueueMonitoring();
    await this.leave();
    this.clear();
  }
}
