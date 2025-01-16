import { Market, Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import { MarketHandler } from '../market/marketHandler.js';
import { BalanceHandler } from '../balance/balanceHandler.js';
import { KeyHandler } from '../key/keyHandler.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { StakeHandler } from '../stake/StakeHandler.js';
import { ContainerOrchestrationInterface } from '../../provider/containerOrchestration/interface.js';
import { askYesNoQuestion } from '../../../../generic/utils.js';
export class HealthHandler {
  private address: PublicKey;

  private balanceHandler: BalanceHandler;
  private stakeHandler: StakeHandler;

  constructor(
    private sdk: SDK,
    private containerOrchestration: ContainerOrchestrationInterface,
    private marketHandler: MarketHandler,
    private keyHandler: KeyHandler,
  ) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;

    this.balanceHandler = new BalanceHandler(this.sdk);
    this.stakeHandler = new StakeHandler(this.sdk);

    applyLoggingProxyToClass(this);
  }

  async run(market: string): Promise<boolean> {
    /**
     * market health check,
     *
     * check if the market supplied is valid and can be joined
     */
    const marketAccount = await this.marketHandler.check(market);

    /**
     * balances (SOL) health check
     *
     * check if the balance can be gotten and check that the balance is
     * sufficient, if the balance can't be gotten skip the check
     */
    if (await this.balanceHandler.balance()) {
      await this.balanceHandler.check();
    }

    /**
     * staking healtcheck, check if market can be joined or staking is needed
     */
    await this.stake(marketAccount);

    /**
     * health check on market access key
     */
    if (this.keyHandler.doesMarketNeedAccessKey(marketAccount)) {
      await this.keyHandler.loadAccessKeyFromChain(marketAccount);
    }

    /**
     * health check for provider (docker or podman) health
     */
    await this.containerOrchestration.check();

    return true;
  }

  async stake(market: Market): Promise<boolean> {
    /**
     * create/skip creating the ATA account for the node
     * if the node already has this will be skipping
     */
    await this.stakeHandler.createAta();

    if (!(await this.stakeHandler.nodeHasStakingAccount())) {
      await this.stakeHandler.createStakingAccount();
    }

    let stake = this.stakeHandler.getStakeAccount();

    if (
      !this.stakeHandler.canProceedWithoutStake(
        market,
        this.balanceHandler.getNosBalance(),
      )
    ) {
      console.log(this.stakeHandler.getStakeActionInfotext(market));
      await askYesNoQuestion(
        this.stakeHandler.getStakeActionQuerytext(market),
        async () => {
          await this.stakeHandler.topUpStakingAccount(market);
          stake = this.stakeHandler.getStakeAccount();
        },
        () => {
          this.stakeHandler.failTopUpStakingAccount();
        },
      );
    }

    return true;
  }
}
