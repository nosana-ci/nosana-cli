import { Market, Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import { EMPTY_ADDRESS } from '../../../jobs.js';
import { config } from '../../../../generic/config.js';

export class KeyHandler {
  private address: PublicKey;
  private key: PublicKey | undefined;
  private market: PublicKey | undefined;

  constructor(private sdk: SDK) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
  }

  getMarket(): PublicKey | undefined {
    return this.market;
  }

  setMarket( market?: PublicKey) {
    this.market = market;
  }

  getAccessKey(): PublicKey | undefined {
    return this.key;
  }

  setAccessKey( key?: PublicKey ) {
    this.key = key;
  }

  doesMarketNeedAccessKey(market: Market): boolean {
    if (market!.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()) {
      return false;
    }

    return true;
  }

  async loadAccessKeyFromChain(market: Market): Promise<PublicKey | undefined> {
    try {
      this.key = await this.sdk.solana.getNftFromCollection(
        this.address,
        market!.nodeAccessKey.toString(),
      );

      if (!this.key) {
        throw new Error('Could not find access key');
      }

      return this.key;
    } catch (error) {
      throw new Error(`error loading Access Key from chain: ${error}`);
    }
  }

  async join(): Promise<void> {
    const signature = (await this.sdk.solana.signMessage(
      config.signMessage,
    )) as Uint8Array;
    const base64Signature = Buffer.from(signature).toString('base64');
    // If we don't specify a market, try to get the correct market from the backend
    try {
      // Check if node is onboarded and has received access key
      // if not call onboard endpoint to create access key tx
      const response = await fetch(
        `${config.backendUrl}/nodes/${this.address}`,
        {
          method: 'GET',
          headers: {
            Authorization: `${this.address}:${base64Signature}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();

      if (!result || (result && result.name === 'Error')) {
        throw new Error(result.message);
      }
      if (result.status !== 'onboarded') {
        throw new Error('Node not onboarded yet');
      }

      this.key = new PublicKey(result.accessKeyMint);
      this.market = new PublicKey(result.marketAddress);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Node not onboarded yet')) {
        throw new Error(
          'Node is still on the waitlist, wait until you are accepted.',
        );
      } else if (e instanceof Error && e.message.includes('Node not found')) {
        throw new Error(
          'Node is not registred yet. To register run the join-test-grid command.',
        );
      }
      throw e;
    }
  }
}
