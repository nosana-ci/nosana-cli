import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import bs58 from 'bs58';
import type { IPFSConfig } from '../types/config.js';
import { IPFSConfigDefault } from '../config_defaults.js';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { lookup } from 'mime-types';
import FormData from 'form-data';

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

  /**
   * Converts IPFS hash to byte array needed to submit results
   * @param hash IPFS hash
   * @returns Array<number>
   */
  IpfsHashToByteArray(hash: string): Array<number> {
    return [...bs58.decode(hash).subarray(2)];
  }

  async retrieve(
    hash: string | Array<number>,
    options: AxiosRequestConfig = {},
  ): Promise<any> {
    if (typeof hash !== 'string') hash = IPFS.solHashToIpfsHash(hash);
    const response = await axios.get(this.config.gateway + hash, options);
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
  /**
   * Function to pin data into Pinata Cloud
   * @param data Object to pin into IPFS as JSON
   */
  async pinFile(filePath: string): Promise<string> {
    let data = new FormData();
    // const file = new Blob([await readFile(filePath)], {
    //   type: lookup(filePath) ? (lookup(filePath) as string) : undefined,
    // });
    // data.set('file', file, filePath.split('/').pop());
    data.append('file', createReadStream(filePath));
    const response = await this.api.post('/pinning/pinFileToIPFS', data, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
        Authorization: `Bearer ${this.config.jwt}`,
      },
    });
    return response.data.IpfsHash;
  }
}
