import { sleep } from '@nosana/sdk';
import { StatusEmitter } from './statusEmitter.js';
import { createSignature } from '../../../api.js';
import { configs } from '../../../NodeManager/configs/configs.js';

export async function createListener(
  nodeAddress: string,
  jobAddress: string,
  statusEmitter: StatusEmitter,
) {
  await sleep(3);
  const headers = await createSignature();
}
