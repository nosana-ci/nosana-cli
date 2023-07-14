// external imports
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { web3 } from '@coral-xyz/anchor';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { sign } from 'tweetnacl';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// local imports
import { colors, gitlabLog, now } from '../utils';
import { PublicKey } from '@solana/web3.js';

/**
 * Class to interact with Nosana Secret Manager
 * https://docs.nosana.io/secrets/start.html
 */
export class SecretManager {
  public api: AxiosInstance;
  constructor(load = true) {
    this.api = axios.create({ baseURL: process.env.SECRET_MANAGER });
    if (load && existsSync(process.env.SECRET_TOKEN)) this.setToken(readFileSync(process.env.SECRET_TOKEN).toString());

    // by default, it retries if it is a network error or a 5xx error
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: () => 5e3,
      retryCondition: (error) => error.response && error.response.status === 500,
      onRetry: (retryCount) =>
        gitlabLog(`Retrying secrets manager internal error 500 (${colors.RED}${retryCount}${colors.WHITE})...`),
    });

    // retry 403 once, if the token expired or not yet present
    axiosRetry(this.api, {
      retries: 1,
      retryDelay: () => 5e3,
      retryCondition: (error) => error.response && error.response.status === 403,
      onRetry: async (retryCount, error, requestConfig) => {
        await this.login();
        requestConfig.headers['Authorization'] = this.api.defaults.headers.Authorization;
      },
    });

    // retry 400 when Solana state has not propagated yet to secrets manager
    axiosRetry(this.api, {
      retries: 10,
      retryDelay: () => 5e3,
      retryCondition: (error) => error.response && error.response.status === 400,
      onRetry: (retryCount) =>
        gitlabLog(`Retrying secrets results retrieval (${colors.RED}${retryCount}${colors.WHITE})...`),
    });
  }

  setToken(token: string) {
    this.api.defaults.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Function to create a secret in the Nosana Secret manager
   */
  async login(job = null) {
    const timestamp = now();
    const keyPair = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.SOLANA_WALLET)));
    const response = await this.api.post(
      '/login',
      {
        address: keyPair.publicKey.toBase58(),
        signature: bs58.encode(
          sign.detached(new TextEncoder().encode(`nosana_secret_${timestamp}`), keyPair.secretKey)
        ),
        timestamp,
        ...(job !== null && { job }),
      },
      {
        headers: {
          Authorization: null,
        },
      }
    );
    if (job === null) writeFileSync(process.env.SECRET_TOKEN, response.data.token);
    this.setToken(response.data.token);
    gitlabLog(`Retrieved secret manager ${colors.CYAN}${job !== null ? 'job' : 'generic'}${colors.WHITE} token.`);
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
  async get(job: PublicKey): Promise<AxiosResponse> {
    await this.login(job.toString());
    return await this.api.get('/secrets');
  }

  /**
   * Function to delete a secret in the Nosana Secret manager
   * @param key The key of secret that has to be removed, a string.
   */
  async delete(key: string): Promise<AxiosResponse> {
    return await this.api.delete(`/secrets`, { data: { key } });
  }
}
