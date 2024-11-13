import { Request } from 'express';
import { PublicKey } from '@solana/web3.js';

import { NodeRepository } from '../../../repository/NodeRepository';
import ApiEventEmitter from '../ApiEventEmitter';
import { FlowHandler } from '../../flow/flowHandler';

export type NodeAPIRequest<Params = {}, Body = {}> = Request<
  Params,
  {},
  Body
> & {
  address?: PublicKey;
  eventEmitter?: ApiEventEmitter;
  flowHandler?: FlowHandler;
  repository?: NodeRepository;
  signature?: string;
};
