export type NosanaStake = {
  "version": "2.1.37",
  "name": "nosana_staking",
  "instructions": [
      {
          "name": "init",
          "accounts": [
              {
                  "name": "settings",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": true,
                  "isSigner": true
              },
              {
                  "name": "systemProgram",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "rent",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": []
      },
      {
          "name": "stake",
          "accounts": [
              {
                  "name": "mint",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "user",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": true,
                  "isSigner": true
              },
              {
                  "name": "systemProgram",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "tokenProgram",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "rent",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": [
              {
                  "name": "amount",
                  "type": "u64"
              },
              {
                  "name": "duration",
                  "type": "u128"
              }
          ]
      },
      {
          "name": "unstake",
          "accounts": [
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "reward",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              }
          ],
          "args": []
      },
      {
          "name": "restake",
          "accounts": [
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              }
          ],
          "args": []
      },
      {
          "name": "topup",
          "accounts": [
              {
                  "name": "user",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              },
              {
                  "name": "tokenProgram",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": [
              {
                  "name": "amount",
                  "type": "u64"
              }
          ]
      },
      {
          "name": "extend",
          "accounts": [
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              }
          ],
          "args": [
              {
                  "name": "duration",
                  "type": "u64"
              }
          ]
      },
      {
          "name": "close",
          "accounts": [
              {
                  "name": "user",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": true,
                  "isSigner": true
              },
              {
                  "name": "tokenProgram",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": []
      },
      {
          "name": "withdraw",
          "accounts": [
              {
                  "name": "user",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": true,
                  "isSigner": true
              },
              {
                  "name": "tokenProgram",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": []
      },
      {
          "name": "slash",
          "accounts": [
              {
                  "name": "vault",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "stake",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "tokenAccount",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "settings",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              },
              {
                  "name": "tokenProgram",
                  "isMut": false,
                  "isSigner": false
              }
          ],
          "args": [
              {
                  "name": "amount",
                  "type": "u64"
              }
          ]
      },
      {
          "name": "updateSettings",
          "accounts": [
              {
                  "name": "newAuthority",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "tokenAccount",
                  "isMut": false,
                  "isSigner": false
              },
              {
                  "name": "settings",
                  "isMut": true,
                  "isSigner": false
              },
              {
                  "name": "authority",
                  "isMut": false,
                  "isSigner": true
              }
          ],
          "args": []
      }
  ],
  "accounts": [
      {
          "name": "SettingsAccount",
          "type": {
              "kind": "struct",
              "fields": [
                  {
                      "name": "authority",
                      "type": "publicKey"
                  },
                  {
                      "name": "tokenAccount",
                      "type": "publicKey"
                  }
              ]
          }
      },
      {
          "name": "StakeAccount",
          "type": {
              "kind": "struct",
              "fields": [
                  {
                      "name": "amount",
                      "type": "u64"
                  },
                  {
                      "name": "authority",
                      "type": "publicKey"
                  },
                  {
                      "name": "duration",
                      "type": "u64"
                  },
                  {
                      "name": "timeUnstake",
                      "type": "i64"
                  },
                  {
                      "name": "vault",
                      "type": "publicKey"
                  },
                  {
                      "name": "vaultBump",
                      "type": "u8"
                  },
                  {
                      "name": "xnos",
                      "type": "u128"
                  }
              ]
          }
      }
  ],
  "errors": [
      {
          "code": 6000,
          "name": "AmountNotEnough",
          "msg": "This amount is not enough."
      },
      {
          "code": 6001,
          "name": "AlreadyInitialized",
          "msg": "This stake is already running."
      },
      {
          "code": 6002,
          "name": "AlreadyClaimed",
          "msg": "This stake is already claimed."
      },
      {
          "code": 6003,
          "name": "AlreadyStaked",
          "msg": "This stake is already staked."
      },
      {
          "code": 6004,
          "name": "AlreadyUnstaked",
          "msg": "This stake is already unstaked."
      },
      {
          "code": 6005,
          "name": "NotUnstaked",
          "msg": "This stake is not yet unstaked."
      },
      {
          "code": 6006,
          "name": "Locked",
          "msg": "This stake is still locked."
      },
      {
          "code": 6007,
          "name": "DurationTooShort",
          "msg": "This stake duration is not long enough."
      },
      {
          "code": 6008,
          "name": "DurationTooLong",
          "msg": "This stake duration is too long."
      },
      {
          "code": 6009,
          "name": "DoesNotExist",
          "msg": "This stake account does not exist."
      },
      {
          "code": 6010,
          "name": "Decreased",
          "msg": "This stake is not allowed to decrease."
      },
      {
          "code": 6011,
          "name": "HasReward",
          "msg": "This stake still has a reward account."
      },
      {
          "code": 6012,
          "name": "InvalidStakeAccount",
          "msg": "This stake does not belong to the authority."
      }
  ]
}