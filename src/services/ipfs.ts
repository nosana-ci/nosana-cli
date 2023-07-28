import axios, { AxiosHeaders, AxiosInstance } from 'axios';
import bs58 from 'bs58';
import type { IPFSConfig } from '../types/config.js';
import { IPFSConfigDefault } from '../config_defaults.js';

/**
 * Class to interact with Pinata Cloud
 * https://www.pinata.cloud/
 */
export class IPFS {
  private api: AxiosInstance;
  config: IPFSConfig = IPFSConfigDefault;

  constructor(config?: Partial<IPFSConfig>) {
    Object.assign(this.config, config);
    const headers: AxiosHeaders = new AxiosHeaders();
    if (this.config.jwt) {
      headers.set('Authorization', `Bearer ${this.config.jwt}`);
    }
    this.api = axios.create({
      baseURL: this.config.api,
      headers,
    });
  }
  /**
   * Convert the ipfs bytes from a solana job to a CID
   * It prepends the 0x1220 (18,32) to make it 34 bytes and Base58 encodes it.
   * This result is IPFS addressable.
   */
  static solHashToIpfsHash(hashArray: Array<number>): string {
    if (hashArray.length === 32) {
      hashArray.unshift(18, 32);
    }
    return bs58.encode(Buffer.from(hashArray));
  }

  async retrieve(hash: string | Array<number>): Promise<any> {
    if (typeof hash !== 'string') hash = IPFS.solHashToIpfsHash(hash);
    const response = await axios.get(this.config.gateway + hash);
    return response.data;
  }

  /**
   * Function to pin data into Pinata Cloud
   * @param data Object to pin into IPFS as JSON
   */
  async pin(data: object): Promise<string> {
    const response = await this.api.post('/pinning/pinJSONToIPFS', data);
    return response.data.IpfsHash;
  }
}
