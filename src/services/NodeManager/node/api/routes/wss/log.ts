import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { Job, Client as SDK } from '@nosana/sdk';

import { configs } from '../../../../configs/nodeConfigs.js';
import { logStreaming } from '../../../../monitoring/streaming/LogStreamer.js';

/**
 * this is for log streaming, this is going to be used by the basic job poster
 * just to show that clients logs, both from the node and the container
 */
export async function wssLogRoute(
  header: string,
  body: { jobAddress: string; address: string },
  walletAddress: PublicKey,
  sdk: SDK,
  ws: WebSocket,
) {
  // valid authurization (public key and signature)
  const [nodeAddress, base64Signature] = header.split(':');
  const signature = Buffer.from(base64Signature, 'base64');
  const publicKey = new PublicKey(nodeAddress);
  const message = Buffer.from(configs().signMessage);

  if (!nacl.sign.detached.verify(message, signature, publicKey.toBytes())) {
    ws.send('Invalid signature');
    return;
  }

  const { jobAddress, address } = body;

  if (!jobAddress || !address) {
    ws.send('Invalid job params');
  }

  // job owner validation
  const job: Job = await sdk.jobs.get(jobAddress);

  if (address !== job.project.toString()) {
    ws.send('Invalid address');
    return;
  }

  logStreaming(walletAddress.toString()).subscribe(ws, jobAddress);
}
