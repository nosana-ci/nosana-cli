import { PublicKey } from '@solana/web3.js';
import { Job, Client as SDK } from '@nosana/sdk';
import nacl from 'tweetnacl';
import WebSocket from 'ws';

import { configs } from '../../../../configs/configs.js';
import { stateStreaming } from '../../../../monitoring/streaming/StateStreamer.js';

/**
 * this is to handle state streaming, this would be used for external
 * sevices to follow a job or node state
 */
export async function wssStatusRoute(
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

  stateStreaming(walletAddress.toString()).subscribe(ws, jobAddress);
}
