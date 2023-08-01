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
  const json_flow = {
    ops: [
      {
        op: 'container/run',
        id: 'echo',
        args: {
          cmds: [
            {
              cmd: "sh -c 'echo '\"'\"'#!/bin/sh\necho '\"'\"'\"'\"'\"'\"'\"'\"'\u001b[1;32m$ echo \"Hello World!\"\u001b[0m'\"'\"'\"'\"'\"'\"'\"'\"'\necho \"Hello World!\" '\"'\"' | sh'",
            },
          ],
          image: 'ubuntu',
        },
      },
    ],
  };
  const ipfsHash = await nosana.ipfs.pin(json_flow);
  console.log('ipfs uploaded!', nosana.ipfs.config.gateway + ipfsHash);
  const response = await nosana.solana.listJob(ipfsHash);
  console.log('job posted!', response);
  let job;
  while (!job || parseInt(job.state) < 2) {
    console.log('checking job state..');
    job = await nosana.solana.getJob(response.job);
    await sleep(5);
  }
  console.log('job done!');
  const result = await nosana.ipfs.retrieve(job.ipfsResult);
  console.log(result);
  const secrets = await nosana.secrets.get(response.job);
  console.log(secrets);
})();
