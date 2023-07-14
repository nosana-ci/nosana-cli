import axios, { AxiosInstance } from 'axios';
import bs58 from 'bs58';
import type { IPFSConfig } from '../types/config';
import { IPFSConfigDefault } from '../config_defaults';

/**
 * Class to interact with Pinata Cloud
 * https://www.pinata.cloud/
 */
export class IPFS {
  private api: AxiosInstance;
  private config: IPFSConfig = IPFSConfigDefault;

  constructor(config?: Partial<IPFSConfig>) {
    Object.assign(this.config, config);
    this.api = axios.create({
      baseURL: this.config.api,
      headers: {
        Authorization: `Bearer ${this.config.jwt}`,
      },
    });
  }
  /**
   * Convert the ipfs bytes from a solana job to a CID
   * It prepends the 0x1220 (18,32) to make it 34 bytes and Base58 encodes it.
   * This result is IPFS addressable.
   */
  static solHashToIpfsHash(hashArray: Array<number>): string {
    hashArray.unshift(18, 32);
    return bs58.encode(Buffer.from(hashArray));
  }

  async retrieve(hash: string): Promise<any> {
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
