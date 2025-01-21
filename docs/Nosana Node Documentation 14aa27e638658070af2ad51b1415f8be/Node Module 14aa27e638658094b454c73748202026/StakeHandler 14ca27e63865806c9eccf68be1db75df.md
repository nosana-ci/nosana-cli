# StakeHandler

`stakeHandler.ts`

The `StakeHandler` class is designed to manage staking operations for nodes in the Nosana ecosystem. It provides methods for creating staking accounts, checking staking requirements, topping up stakes, and retrieving staking information. This ensures nodes meet the minimum staking requirements necessary to participate in specific markets while providing utility methods to streamline staking processes.

---

## **Core Responsibilities**

1. **Account Creation and Management**
    - Create associated token accounts (ATA) for staking.
    - Check and create staking accounts as needed.
2. **Stake Management**
    - Retrieve and update current staking amounts and durations.
    - Top up staking accounts to meet minimum market requirements.
3. **Stake Validation**
    - Validate if the node's current stake meets the minimum requirements for market participation.
    - Provide user-friendly information and prompts for staking actions.