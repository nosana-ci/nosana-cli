import { Client, IPFS } from './src';
import type { ClientConfig } from './src/types';

const config: ClientConfig = {
  solana: {
    network: 'devnet',
  },
};

const nosana: Client = new Client(config);

(async () => {
  const jobAddress = 'FW1fTCgGFD5CaJt4AAxRFNiKEnXK84ezS5hbKZg7DNJh';
  const job = await nosana.solana.getJob(jobAddress);
  console.log(job);
  const result = await nosana.ipfs.retrieve(
    IPFS.solHashToIpfsHash(job.ipfsResult),
  );
  console.log(result);
  const secrets = await nosana.secrets.get(jobAddress);
  console.log(secrets);
})();
