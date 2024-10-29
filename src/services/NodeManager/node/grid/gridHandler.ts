import { KeyWallet, Market, Run, Client as SDK } from '@nosana/sdk';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { config } from '../../../../generic/config.js';
import {
  BlockheightBasedTransactionConfirmationStrategy,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import { getRawTransaction } from '../../../sdk.js';
import { sleep } from '../../../../generic/utils.js';

export interface NodeData {
  market?: string;
  status: string;
}

export class GridHandler {
  private address: PublicKey;

  constructor(private sdk: SDK, private repository: NodeRepository) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
    applyLoggingProxyToClass(this);
  }

  private async getAuthSignature(): Promise<string> {
    const signature = (await this.sdk.solana.signMessage(
      config.signMessage,
    )) as Uint8Array;
    return Buffer.from(signature).toString('base64');
  }

  public async getNodeStatus(): Promise<NodeData> {
    try {
      const response = await fetch(
        `${config.backendUrl}/nodes/${this.address}`,
        {
          method: 'GET',
          headers: {
            Authorization: `${this.address}:${await this.getAuthSignature()}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const data = await response.json();

      if (!data || (data.name === 'Error' && data.message))
        throw new Error(data.message);

      return {
        status: data.status,
        market: data.marketAddress,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('Node not onboarded yet')
      ) {
        throw new Error(
          'Node is still on the waitlist, wait until you are accepted.',
        );
      } else if (
        error instanceof Error &&
        error.message.includes('Node not found')
      ) {
        throw new Error(
          'Node is not registred yet. To register run the join-test-grid command.',
        );
      }
      throw error;
    }
  }

  async recommend(): Promise<any> {
    const gpus = this.repository.getNodeInfo().gpus;
    const signature = await this.getAuthSignature();

    try {
      let market: string;
      const response = await fetch(
        `${config.backendUrl}/nodes/${this.address}/check-market`,
        {
          method: 'POST',
          headers: {
            Authorization: `${this.address}:${signature}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gpus }),
        },
      );

      let data: any = await response.json();

      if (
        !data ||
        (data.name === 'Error' && data.message) ||
        !data.marketAddress
      ) {
        if (
          data.message.includes('Assigned market doesnt support current GPU')
        ) {
          data = await this.changeMarket();
          market = data.newMarket;
        } else {
          throw new Error(data.message);
        }
      } else {
        market = data.marketAddress;
      }

      return market;
    } catch (error) {
      throw error;
    }
  }

  private async changeMarket(): Promise<void> {
    try {
      const response = await fetch(`${config.backendUrl}/nodes/change-market`, {
        method: 'POST',
        headers: {
          Authorization: `${this.address}:${await this.getAuthSignature()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: this.address }),
      });

      const data = await response.json();
      if (!data || data.name === 'Error') throw new Error(data.message);

      try {
        const txnSignature = await this.signAndSendTransaction(data.tx);
        await this.confirmTransaction(txnSignature);

        await sleep(30);

        await this.syncNodeAfterMint();
      } catch (error) {
        throw new Error(`Failed to mint access key: ${error}`);
      }
    } catch (error: unknown) {
      throw new Error(
        'Something went wrong with minting your access key, please try again. ' +
          error,
      );
    }
  }

  private async signAndSendTransaction(
    txData: any,
  ): Promise<string | undefined> {
    const feePayer = (this.sdk.solana.provider?.wallet as KeyWallet).payer;
    const recoveredTransaction = await getRawTransaction(
      Uint8Array.from(Object.values(txData)),
    );

    if (recoveredTransaction instanceof VersionedTransaction) {
      recoveredTransaction.sign([feePayer]);
    } else {
      recoveredTransaction.partialSign(feePayer);
    }

    const txnSignature = await this.sdk.solana.connection?.sendRawTransaction(
      recoveredTransaction.serialize(),
    );

    return txnSignature;
  }

  private async confirmTransaction(
    txnSignature: string | undefined,
  ): Promise<void> {
    const latestBlockHash =
      await this.sdk.solana.connection?.getLatestBlockhash();
    if (latestBlockHash && txnSignature) {
      const confirmStrategy: BlockheightBasedTransactionConfirmationStrategy = {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txnSignature,
      };
      await this.sdk.solana.connection?.confirmTransaction(confirmStrategy);
    } else {
      throw new Error('Could not confirm minting transaction');
    }
  }

  private async syncNodeAfterMint(): Promise<any> {
    try {
      const response = await fetch(`${config.backendUrl}/nodes/sync-node`, {
        method: 'POST',
        headers: {
          Authorization: `${this.address}:${await this.getAuthSignature()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: this.address }),
      });
      return response.json();
    } catch (error) {
      throw error;
    }
  }
}
