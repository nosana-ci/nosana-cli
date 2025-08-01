import { Request } from 'express';
import { PublicKey } from '@solana/web3.js';
import { NodeRepository } from '../../../repository/NodeRepository.js';
import ApiEventEmitter from '../ApiEventEmitter.js';
import { Provider } from '../../../provider/Provider.js';

export type NodeAPIRequest<Params = {}, Body = {}> = Request<
  Params,
  {},
  Body
> & {
  address?: PublicKey;
  eventEmitter?: ApiEventEmitter;
  repository?: NodeRepository;
  provider?: Provider;
  signature?: string;
};
