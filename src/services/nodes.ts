import { PublicKey} from '@solana/web3.js';

import type { Node } from '../types/index.js';
import { SolanaManager } from './solana.js';

export class Nodes extends SolanaManager {
  constructor(...args: any){ super(...args); }

  /**
   * Function to fetch a node from chain
   * @param node Publickey address of the node to fetch
   * @param authority options, if authority is true it will search node on authority address
   */
  async get(node: PublicKey | string, options: { authority: Boolean }) : Promise<Node> {
    if (typeof node === 'string') node = new PublicKey(node);
    await this.loadNosanaNodes();

    if (options && options.authority) {
      // @ts-ignore:next-line
      const nodeAccount = await this.nodes!.account.nodeAccount.all([
        { memcmp: { offset: 8, bytes: node.toString() } },
      ]);
      nodeAccount[0].account.address = nodeAccount[0].publicKey.toString();
      return nodeAccount[0].account;
    } else {
      // @ts-ignore:next-line
      return await this.nodes!.account.nodeAccount.fetch(node);
    }
  }

  /**
   * Function to fetch a nodes from chain
   * @param job Publickey address of the node to fetch
   */
  async all() : Promise<Node[]> {
    await this.loadNosanaNodes();
    // @ts-ignore:next-line
    const nodes = await this.nodes!.account.nodeAccount.all()
    return nodes.map((n: any) => {
      n.account.address = n.publicKey.toString();
      return n.account;
    });
  }
}
