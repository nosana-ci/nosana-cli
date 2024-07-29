import { S3Resource } from '../../../../../types/resources';

export const getMarketRequiredVolumes = (market: string): S3Resource[] => [
  {
    bucket: 's3://nosana-llama3.1',
    target: '/models',
  },
];
