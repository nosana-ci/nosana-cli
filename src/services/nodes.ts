import { PublicKey} from '@solana/web3.js';

import type { Node } from '../types/index.js';
import { SolanaManager } from './solana.js';

export class Nodes extends SolanaManager {
  constructor(...args: any){ super(...args); }

  /**
   * Function to fetch a node from chain
   * @param job Publickey address of the node to fetch
   */
  async get(node: PublicKey | string) : Promise<Node> {
    if (typeof node === 'string') node = new PublicKey(node);
    await this.loadNosanaNodes();
    return await this.nodes!.account.NodeAccount.fetch(node);
  }

  /**
   * Function to fetch a nodes from chain
   * @param job Publickey address of the node to fetch
   */
  async getAll() : Promise<Node[]> {
    await this.loadNosanaNodes();
    // @ts-ignore:next-line
    const nodes = await this.nodes!.account.nodeAccount.all()
    return nodes.map((n: any) => {
      return n.account;
    });
  }
}
