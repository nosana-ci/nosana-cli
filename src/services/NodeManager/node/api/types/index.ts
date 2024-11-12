import { Request } from 'express';
import { PublicKey } from '@solana/web3.js';

import { NodeRepository } from '../../../repository/NodeRepository';
import ApiEventEmitter from '../ApiEventEmitter';

export type NodeAPIRequest<Params = {}, Body = {}> = Request<
  Params,
  {},
  Body
> & {
  address?: PublicKey;
  eventEmitter?: ApiEventEmitter;
  repository?: NodeRepository;
};
