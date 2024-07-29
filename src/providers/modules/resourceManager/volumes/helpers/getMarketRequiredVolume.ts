export const getMarketRequiredVolumes = (market: string): S3Resource[] => [
  {
    bucket: 's3://nosana-llama3.1',
    target: '/models',
    IAM: {
      ACCESS_KEY_ID: 'AKIAVRKRZUWKR2JNDW65',
      SECRET_ACCESS_KEY: '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',
    },
  },
];
