import { AnchorProvider, Idl, Program, setProvider } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, getAccount, createAssociatedTokenAccount, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
  Connection,
} from '@solana/web3.js';
import type { Cluster, TokenAmount } from '@solana/web3.js';
import {
  associatedAddress,
  TOKEN_PROGRAM_ID,
} from '@coral-xyz/anchor/dist/cjs/utils/token.js';
import { bs58, utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';

import type { NosanaJobs, SolanaConfig, NosanaNodes, NosanaStake } from '../types/index.js';
import { KeyWallet } from '../utils.js';
import { solanaConfigDefault } from '../config_defaults.js';
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider.js';

const pda = (
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey,
): PublicKey => PublicKey.findProgramAddressSync(seeds, programId)[0];

/**
 * Class to interact with Nosana Programs on the Solana Blockchain,
 * with the use of Anchor.
 */
export class SolanaManager {
  provider: AnchorProvider | undefined;
  jobs: Program<NosanaJobs> | undefined;
  nodes: Program<NosanaNodes> | undefined;
  stake: Program<NosanaStake> | undefined;
  accounts: { [key: string]: PublicKey } | undefined;
  config: SolanaConfig = solanaConfigDefault;
  connection: Connection | undefined;
  constructor(config?: Partial<SolanaConfig>) {
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
      // @ts-ignore
      this.config.wallet = new KeyWallet(this.config.wallet);
    }
    if (typeof process !== 'undefined' && process.env?.ANCHOR_PROVIDER_URL) {
      // TODO: figure out if we want to support this or not
      this.provider = AnchorProvider.env();
    } else {
      let node = this.config.network;
      if (!this.config.network.includes('http')) {
        node = clusterApiUrl(this.config.network as Cluster);
      }
      this.connection = new Connection(node, 'confirmed');
      this.provider = new AnchorProvider(
        this.connection,
        this.config.wallet as Wallet,
        {},
      );
    }
    setProvider(this.provider);
  }

  async requestAirdrop(amount = 1e9, publicKey?: PublicKey): Promise<string | boolean> {
    try {
      if (this.connection) {
        let txhash = await this.connection.requestAirdrop(
          publicKey ? publicKey : (this.config.wallet as Wallet).publicKey,
          amount,
        );
        return txhash;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  }

  async getNosBalance(
    address?: string | PublicKey,
  ): Promise<TokenAmount | undefined> {
    if (!address) {
      address = this.provider?.wallet.publicKey;
    }
    if (typeof address === 'string') address = new PublicKey(address);
    const mintAccount = new PublicKey(this.config.nos_address);
    const account = await this.connection!.getTokenAccountsByOwner(address!, {
      mint: mintAccount,
    });
    if (!account.value[0]) return;
    const tokenAddress = new PublicKey(account.value[0].pubkey.toString());
    const tokenBalance = await this.connection!.getTokenAccountBalance(
      tokenAddress,
    );
    return tokenBalance.value;
  }

  async getSolBalance(address?: string | PublicKey): Promise<number> {
    if (!address) {
      address = this.provider?.wallet.publicKey;
    }
    if (typeof address === 'string') address = new PublicKey(address);
    const tokenBalance = await this.connection!.getBalance(address!);
    return tokenBalance;
  }

  /**
   * Create a NOS ATA for given address
   * @param address
   * @returns ATA public key
   */
  async createNosAta(address: string | PublicKey) {
    if (typeof address === 'string') address = new PublicKey(address);
    const ata = await getAssociatedTokenAddress(new PublicKey(this.config.nos_address), address);
    let tx;
    try {
      await getAccount(this.connection!, ata);
    } catch (error) {
      try {
        tx = await createAssociatedTokenAccount(
          this.connection!,
          (this.provider?.wallet as KeyWallet).payer,
          new PublicKey(this.config.nos_address),
          address,
          {},
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      } catch (e) {
        console.error('createAssociatedTokenAccount', e);
      }
    }
    return tx;
  }

  /**
   * get the NOS ATA of an address
   * @param address
   * @returns ATA Publickey
   */
  async getNosATA(address: string | PublicKey) {
    if (typeof address === 'string') address = new PublicKey(address);
    const mint = new PublicKey(this.config.nos_address);
    const ata = await getAssociatedTokenAddress(mint, address);
    return ata;
  }

  /**
   * Function to load the Nosana Jobs program into JS
   * https://docs.nosana.io/programs/jobs.html
   */
  async loadNosanaJobs() {
    if (!this.jobs) {
      const programId = new PublicKey(this.config.jobs_address);
      const idl = (await Program.fetchIdl(programId.toString())) as Idl;
      this.jobs = new Program(idl, programId) as unknown as Program<NosanaJobs>;
    }
  }

  /**
   * Function to load the Nosana Nodes program into JS
   * https://docs.nosana.io/programs/nodes.html
   */
  async loadNosanaNodes() {
    if (!this.nodes) {
      const programId = new PublicKey(this.config.nodes_address);
      const idl = (await Program.fetchIdl(programId.toString())) as Idl;
      this.nodes = new Program(
        idl,
        programId,
      ) as unknown as Program<NosanaNodes>;
    }
  }

    /**
   * Function to load the Nosana Stake program into JS
   * https://docs.nosana.io/programs/staking.html
   */
    async loadNosanaStake() {
      if (!this.stake) {
        const programId = new PublicKey(this.config.stake_address);
        const idl = (await Program.fetchIdl(programId.toString())) as Idl;
        this.stake = new Program(
          idl,
          programId,
        ) as unknown as Program<NosanaStake>;
      }
    }

  /**
   * Function to set and calculate most account addresses needed for instructions
   */
  async setAccounts() {
    if (!this.accounts) {
      await this.loadNosanaJobs();
      const authority = this.provider!.wallet.publicKey;
      const rewardsProgram = new PublicKey(this.config.rewards_address);
      const mint = new PublicKey(this.config.nos_address);
      const market = new PublicKey(this.config.market_address);
      this.accounts = {
        market,
        vault: pda([market.toBuffer(), mint.toBuffer()], this.jobs!.programId),
        user: await associatedAddress({
          mint,
          owner: this.provider!.wallet.publicKey,
        }),
        payer: authority,
        authority,
        rewardsVault: pda([mint.toBuffer()], rewardsProgram),
        rewardsReflection: pda([utf8.encode('reflection')], rewardsProgram),
        rewardsProgram,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
    }
  }
}
