export type BlockchainConfig = {
  network: string;
};

export type ClientConfig = {
  blockchain?: Partial<BlockchainConfig>;
};
