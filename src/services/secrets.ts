// external imports
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import nacl from 'tweetnacl';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// local imports
import { now, KeyWallet } from '../utils';
import { Keypair, PublicKey } from '@solana/web3.js';

import type { SecretsConfig } from '../types';
import { secretsConfigDefault } from '../config_defaults';
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider';

/**
 * Class to interact with Nosana Secret Manager
 * https://docs.nosana.io/secrets/start.html
 */
export class SecretManager {
  public api: AxiosInstance;
  config: SecretsConfig = secretsConfigDefault;
  wallet: Wallet;
  constructor(config?: Partial<SecretsConfig>) {
    Object.assign(this.config, config);
    if (
      typeof this.config.wallet === 'string' ||
      Array.isArray(this.config.wallet)
    ) {
      let key = this.config.wallet;
      if (typeof key === 'string') {
        key = JSON.parse(key);
      }
      this.config.wallet = Keypair.fromSecretKey(
        new Uint8Array(key as Iterable<number>),
      );
    }

    if (this.config.wallet instanceof Keypair) {
      //@ts-ignore
      this.config.wallet = new KeyWallet(this.config.wallet);
    }
    this.wallet = this.config.wallet as Wallet;
    this.api = axios.create({ baseURL: this.config.manager });
    // if (existsSync(process.env.SECRET_TOKEN))
    //   this.setToken(readFileSync(process.env.SECRET_TOKEN).toString());

    // by default, it retries if it is a network error or a 5xx error
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: () => 5e3,
      retryCondition: (error) =>
        (error.response && error.response.status === 500) as boolean,
      onRetry: (retryCount) =>
        console.error(
          `Retrying secrets manager internal error 500 (${retryCount})...`,
        ),
    });

    // retry 403 once, if the token expired or not yet present
    axiosRetry(this.api, {
      retries: 1,
      retryDelay: () => 5e3,
      retryCondition: (error) =>
        (error.response && error.response.status === 403) as boolean,
      onRetry: async (retryCount, error, requestConfig) => {
        await this.login();
        requestConfig.headers!['Authorization'] =
          this.api.defaults.headers.Authorization;
      },
    });

    // retry 400 when Solana state has not propagated yet to secrets manager
    axiosRetry(this.api, {
      retries: 5,
      retryDelay: () => 5e3,
      retryCondition: (error) =>
        (error.response && error.response.status === 400) as boolean,
      onRetry: (retryCount) =>
        console.error(`Retrying secrets results retrieval (${retryCount})...`),
    });
  }

  setToken(token: string) {
    this.api.defaults.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Function to create a secret in the Nosana Secret manager
   */
  async login(job?: string) {
    const timestamp = now();
    const keyPair = (this.wallet as KeyWallet).payer;
    const response = await this.api.post(
      '/login',
      {
        address: keyPair.publicKey.toBase58(),
        signature: bs58.encode(
          nacl.sign.detached(
            new TextEncoder().encode(`nosana_secret_${timestamp}`),
            keyPair.secretKey,
          ),
        ),
        timestamp,
        ...(job && { job }),
      },
      {
        headers: {
          Authorization: null,
        },
      },
    );
    // if (!job) writeFileSync(process.env.SECRET_TOKEN, response.data.token);
    this.setToken(response.data.token);
    console.log(
      `Retrieved secret manager ${job !== null ? 'job' : 'generic'} token.`,
    );
  }

  /**
   * Function to create a secret in the Nosana Secret manager
   * @param secret Object with secret data store
   */
  async create(secret: object): Promise<AxiosResponse> {
    return await this.api.post('/secrets', secret);
  }

  /**
   * Function to get results for a given job
   * @param job public key of the job to get secrets from
   */
  async get(job: PublicKey | string): Promise<AxiosResponse> {
    if (typeof job === 'string') job = new PublicKey(job);
    await this.login(job.toString());
    const response = await this.api.get('/secrets');
    return response.data;
  }

  /**
   * Function to delete a secret in the Nosana Secret manager
   * @param key The key of secret that has to be removed, a string.
   */
  async delete(key: string): Promise<AxiosResponse> {
    return await this.api.delete(`/secrets`, { data: { key } });
  }
}
