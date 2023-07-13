import { Client } from './src';
import type { ClientConfig } from './src/types';

const config: ClientConfig = {
  blockchain: {},
};

const nosana: Client = new Client(config);

console.log(nosana);
