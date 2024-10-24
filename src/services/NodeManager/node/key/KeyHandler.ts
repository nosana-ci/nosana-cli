import { Market, Client as SDK } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { EMPTY_ADDRESS } from "../../../jobs.js";

export class KeyHandler {
    private address: PublicKey;
    private key: PublicKey | undefined = EMPTY_ADDRESS;

    constructor(
        private sdk: SDK,
    ){
        this.address = this.sdk.solana.provider!.wallet.publicKey;
    }

    getAccessKey(): PublicKey | undefined {
        return this.key;
    }

    doesMarketNeedAccessKey(market: Market): boolean {
        if (
            market!.nodeAccessKey.toString() === EMPTY_ADDRESS.toString()
          ) {
            return false;
          }

          return true
    }

    async loadAccessKeyFromChain(market: Market): Promise<PublicKey | undefined> {
        try {
            this.key = await this.sdk.solana.getNftFromCollection(
                this.address,
                market!.nodeAccessKey.toString(),
            );

            if(!this.key) {
                throw new Error('Could not find access key');
            }

            return this.key;
        } catch (error) {
            throw new Error(`error loading Access Key from chain: ${error}`);
        }
    }
}