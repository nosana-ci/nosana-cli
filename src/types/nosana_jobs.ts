export type NosanaJobs = {
  version: '0.1.0';
  name: 'nosana_jobs';
  instructions: [
    {
      name: 'open';
      docs: [
        'Initialize a [MarketAccount](#market-account) and [VaultAccount](#vault-account).',
      ];
      accounts: [
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'market';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'accessKey';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'jobExpiration';
          type: 'i64';
        },
        {
          name: 'jobPrice';
          type: 'u64';
        },
        {
          name: 'jobTimeout';
          type: 'i64';
        },
        {
          name: 'jobType';
          type: 'u8';
        },
        {
          name: 'nodeXnosMinimum';
          type: 'u128';
        },
      ];
    },
    {
      name: 'update';
      docs: ["Update a [MarketAccount](#market-account)'s configurations."];
      accounts: [
        {
          name: 'market';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'accessKey';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'jobExpiration';
          type: 'i64';
        },
        {
          name: 'jobPrice';
          type: 'u64';
        },
        {
          name: 'jobTimeout';
          type: 'i64';
        },
        {
          name: 'jobType';
          type: 'u8';
        },
        {
          name: 'nodeStakeMinimum';
          type: 'u128';
        },
      ];
    },
    {
      name: 'close';
      docs: [
        'Close a [MarketAccount](#market-account) and the associated [VaultAccount](#vault-account).',
      ];
      accounts: [
        {
          name: 'market';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'list';
      docs: [
        'Create a [JobAccount](#job-account) and optional [RunAccount](#run-account).',
      ];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'market';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'run';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'rewardsReflection';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'rewardsVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'rewardsProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'ipfsJob';
          type: {
            array: ['u8', 32];
          };
        },
      ];
    },
    {
      name: 'recover';
      docs: [
        'Recover funds from a [JobAccount](#job-account) that has been [quit](#quit).',
      ];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'market';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'work';
      docs: [
        'Enters the [MarketAccount](#market-account) queue, or create  a [RunAccount](#run-account).',
      ];
      accounts: [
        {
          name: 'run';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'market';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'stake';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'nft';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'stop';
      docs: ['Exit the node queue from [MarketAccount](#market-account).'];
      accounts: [
        {
          name: 'market';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [];
    },
    {
      name: 'claim';
      docs: ['Claim a job that is [stopped](#stop).'];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'run';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'market';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'stake';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'nft';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'finish';
      docs: [
        'Post the result for a  [JobAccount](#job-account) to finish it and get paid.',
      ];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'run';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'market';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'ipfsResult';
          type: {
            array: ['u8', 32];
          };
        },
      ];
    },
    {
      name: 'quit';
      docs: ['Quit a [JobAccount](#job-account) that you have started.'];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'run';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [];
    },
    {
      name: 'clean';
      docs: ['Close an [JobAccount](#job-account).'];
      accounts: [
        {
          name: 'job';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'market';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: 'marketAccount';
      docs: [
        'The `MarketAccount` struct holds all the information about jobs and the nodes queue.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            type: 'publicKey';
          },
          {
            name: 'jobExpiration';
            type: 'i64';
          },
          {
            name: 'jobPrice';
            type: 'u64';
          },
          {
            name: 'jobTimeout';
            type: 'i64';
          },
          {
            name: 'jobType';
            type: 'u8';
          },
          {
            name: 'vault';
            type: 'publicKey';
          },
          {
            name: 'vaultBump';
            type: 'u8';
          },
          {
            name: 'nodeAccessKey';
            type: 'publicKey';
          },
          {
            name: 'nodeXnosMinimum';
            type: 'u128';
          },
          {
            name: 'queueType';
            type: 'u8';
          },
          {
            name: 'queue';
            type: {
              vec: 'publicKey';
            };
          },
        ];
      };
    },
    {
      name: 'jobAccount';
      docs: [
        'The `JobAccount` struct holds all the information about any individual jobs.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'ipfsJob';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'ipfsResult';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'market';
            type: 'publicKey';
          },
          {
            name: 'node';
            type: 'publicKey';
          },
          {
            name: 'payer';
            type: 'publicKey';
          },
          {
            name: 'price';
            type: 'u64';
          },
          {
            name: 'project';
            type: 'publicKey';
          },
          {
            name: 'state';
            type: 'u8';
          },
          {
            name: 'timeEnd';
            type: 'i64';
          },
          {
            name: 'timeStart';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'runAccount';
      docs: [
        'The `RunAccount` struct holds temporary information that matches nodes to jobs.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'job';
            type: 'publicKey';
          },
          {
            name: 'node';
            type: 'publicKey';
          },
          {
            name: 'payer';
            type: 'publicKey';
          },
          {
            name: 'state';
            type: 'u8';
          },
          {
            name: 'time';
            type: 'i64';
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'QueueType';
      docs: ['The `QueueType` describes the type of queue'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Job';
          },
          {
            name: 'Node';
          },
          {
            name: 'Empty';
          },
        ];
      };
    },
    {
      name: 'JobState';
      docs: ['The `JobState` describes the status of a job.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Queued';
          },
          {
            name: 'Running';
          },
          {
            name: 'Done';
          },
          {
            name: 'Stopped';
          },
        ];
      };
    },
    {
      name: 'JobType';
      docs: ['The `JobType` describes the type of any job.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Default';
          },
          {
            name: 'Small';
          },
          {
            name: 'Medium';
          },
          {
            name: 'Large';
          },
          {
            name: 'Gpu';
          },
          {
            name: 'Unknown';
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'InvalidMarketAccount';
      msg: 'This market account is not valid.';
    },
    {
      code: 6001;
      name: 'InvalidJobAccount';
      msg: 'This job account is not valid.';
    },
    {
      code: 6002;
      name: 'JobInWrongState';
      msg: 'This job does not have the right status.';
    },
    {
      code: 6003;
      name: 'JobNotExpired';
      msg: 'The job has not yet expired.';
    },
    {
      code: 6004;
      name: 'NodeQueueDoesNotMatch';
      msg: 'This node queue does not match.';
    },
    {
      code: 6005;
      name: 'NodeStakeUnauthorized';
      msg: 'This node is not authorizing this stake.';
    },
    {
      code: 6006;
      name: 'NodeNotEnoughStake';
      msg: 'This node has not staked enough tokens.';
    },
    {
      code: 6007;
      name: 'NodeAlreadyQueued';
      msg: 'This node is already present in the queue.';
    },
    {
      code: 6008;
      name: 'NodeNftWrongMetadata';
      msg: 'This metadata does not have the correct address.';
    },
    {
      code: 6009;
      name: 'NodeNftWrongOwner';
      msg: 'This NFT is not owned by this node.';
    },
    {
      code: 6010;
      name: 'NodeKeyInvalidCollection';
      msg: 'This access key does not belong to a verified collection.';
    },
  ];
};

export const IDL: NosanaJobs = {
  version: '0.1.0',
  name: 'nosana_jobs',
  instructions: [
    {
      name: 'open',
      docs: [
        'Initialize a [MarketAccount](#market-account) and [VaultAccount](#vault-account).',
      ],
      accounts: [
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'market',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'accessKey',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'jobExpiration',
          type: 'i64',
        },
        {
          name: 'jobPrice',
          type: 'u64',
        },
        {
          name: 'jobTimeout',
          type: 'i64',
        },
        {
          name: 'jobType',
          type: 'u8',
        },
        {
          name: 'nodeXnosMinimum',
          type: 'u128',
        },
      ],
    },
    {
      name: 'update',
      docs: ["Update a [MarketAccount](#market-account)'s configurations."],
      accounts: [
        {
          name: 'market',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'accessKey',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'jobExpiration',
          type: 'i64',
        },
        {
          name: 'jobPrice',
          type: 'u64',
        },
        {
          name: 'jobTimeout',
          type: 'i64',
        },
        {
          name: 'jobType',
          type: 'u8',
        },
        {
          name: 'nodeStakeMinimum',
          type: 'u128',
        },
      ],
    },
    {
      name: 'close',
      docs: [
        'Close a [MarketAccount](#market-account) and the associated [VaultAccount](#vault-account).',
      ],
      accounts: [
        {
          name: 'market',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'list',
      docs: [
        'Create a [JobAccount](#job-account) and optional [RunAccount](#run-account).',
      ],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'market',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'run',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'rewardsReflection',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'rewardsVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'rewardsProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'ipfsJob',
          type: {
            array: ['u8', 32],
          },
        },
      ],
    },
    {
      name: 'recover',
      docs: [
        'Recover funds from a [JobAccount](#job-account) that has been [quit](#quit).',
      ],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'market',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'work',
      docs: [
        'Enters the [MarketAccount](#market-account) queue, or create  a [RunAccount](#run-account).',
      ],
      accounts: [
        {
          name: 'run',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'market',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'stake',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'nft',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'stop',
      docs: ['Exit the node queue from [MarketAccount](#market-account).'],
      accounts: [
        {
          name: 'market',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: 'claim',
      docs: ['Claim a job that is [stopped](#stop).'],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'run',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'market',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'stake',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'nft',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'finish',
      docs: [
        'Post the result for a  [JobAccount](#job-account) to finish it and get paid.',
      ],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'run',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'market',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'ipfsResult',
          type: {
            array: ['u8', 32],
          },
        },
      ],
    },
    {
      name: 'quit',
      docs: ['Quit a [JobAccount](#job-account) that you have started.'],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'run',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: 'clean',
      docs: ['Close an [JobAccount](#job-account).'],
      accounts: [
        {
          name: 'job',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'market',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'marketAccount',
      docs: [
        'The `MarketAccount` struct holds all the information about jobs and the nodes queue.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'authority',
            type: 'publicKey',
          },
          {
            name: 'jobExpiration',
            type: 'i64',
          },
          {
            name: 'jobPrice',
            type: 'u64',
          },
          {
            name: 'jobTimeout',
            type: 'i64',
          },
          {
            name: 'jobType',
            type: 'u8',
          },
          {
            name: 'vault',
            type: 'publicKey',
          },
          {
            name: 'vaultBump',
            type: 'u8',
          },
          {
            name: 'nodeAccessKey',
            type: 'publicKey',
          },
          {
            name: 'nodeXnosMinimum',
            type: 'u128',
          },
          {
            name: 'queueType',
            type: 'u8',
          },
          {
            name: 'queue',
            type: {
              vec: 'publicKey',
            },
          },
        ],
      },
    },
    {
      name: 'jobAccount',
      docs: [
        'The `JobAccount` struct holds all the information about any individual jobs.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'ipfsJob',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'ipfsResult',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'market',
            type: 'publicKey',
          },
          {
            name: 'node',
            type: 'publicKey',
          },
          {
            name: 'payer',
            type: 'publicKey',
          },
          {
            name: 'price',
            type: 'u64',
          },
          {
            name: 'project',
            type: 'publicKey',
          },
          {
            name: 'state',
            type: 'u8',
          },
          {
            name: 'timeEnd',
            type: 'i64',
          },
          {
            name: 'timeStart',
            type: 'i64',
          },
        ],
      },
    },
    {
      name: 'runAccount',
      docs: [
        'The `RunAccount` struct holds temporary information that matches nodes to jobs.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'job',
            type: 'publicKey',
          },
          {
            name: 'node',
            type: 'publicKey',
          },
          {
            name: 'payer',
            type: 'publicKey',
          },
          {
            name: 'state',
            type: 'u8',
          },
          {
            name: 'time',
            type: 'i64',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'QueueType',
      docs: ['The `QueueType` describes the type of queue'],
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Job',
          },
          {
            name: 'Node',
          },
          {
            name: 'Empty',
          },
        ],
      },
    },
    {
      name: 'JobState',
      docs: ['The `JobState` describes the status of a job.'],
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Queued',
          },
          {
            name: 'Running',
          },
          {
            name: 'Done',
          },
          {
            name: 'Stopped',
          },
        ],
      },
    },
    {
      name: 'JobType',
      docs: ['The `JobType` describes the type of any job.'],
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Default',
          },
          {
            name: 'Small',
          },
          {
            name: 'Medium',
          },
          {
            name: 'Large',
          },
          {
            name: 'Gpu',
          },
          {
            name: 'Unknown',
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'InvalidMarketAccount',
      msg: 'This market account is not valid.',
    },
    {
      code: 6001,
      name: 'InvalidJobAccount',
      msg: 'This job account is not valid.',
    },
    {
      code: 6002,
      name: 'JobInWrongState',
      msg: 'This job does not have the right status.',
    },
    {
      code: 6003,
      name: 'JobNotExpired',
      msg: 'The job has not yet expired.',
    },
    {
      code: 6004,
      name: 'NodeQueueDoesNotMatch',
      msg: 'This node queue does not match.',
    },
    {
      code: 6005,
      name: 'NodeStakeUnauthorized',
      msg: 'This node is not authorizing this stake.',
    },
    {
      code: 6006,
      name: 'NodeNotEnoughStake',
      msg: 'This node has not staked enough tokens.',
    },
    {
      code: 6007,
      name: 'NodeAlreadyQueued',
      msg: 'This node is already present in the queue.',
    },
    {
      code: 6008,
      name: 'NodeNftWrongMetadata',
      msg: 'This metadata does not have the correct address.',
    },
    {
      code: 6009,
      name: 'NodeNftWrongOwner',
      msg: 'This NFT is not owned by this node.',
    },
    {
      code: 6010,
      name: 'NodeKeyInvalidCollection',
      msg: 'This access key does not belong to a verified collection.',
    },
  ],
};
