import { Wallet } from '@coral-xyz/anchor';
import { Client, IPFS } from './src';
import type { ClientConfig } from './src/types';
import { sleep } from './src/utils';

const config: ClientConfig = {
  solana: {
    network: 'devnet',
  },
};

const nosana: Client = new Client(config);
console.log(
  'Logged in as',
  (nosana.solana.config.wallet as Wallet).publicKey.toString(),
);

(async () => {
  const response = await nosana.solana.listJob(
    'QmadbEjAJdDNdp6PTyyVeWVcSc8RsEgshBXEMqEGTniiRB',
  );
  console.log('job posted!', response);
  let job;
  while (!job || job.state < 2) {
    console.log('checking job state..');
    job = await nosana.solana.getJob(response.job);
    await sleep(5);
  }
  console.log('job done!');
  const result = await nosana.ipfs.retrieve(
    IPFS.solHashToIpfsHash(job.ipfsResult),
  );
  console.log(result);
  const secrets = await nosana.secrets.get(response.job);
  console.log(secrets);
})();
