import { NodeStateData, NodeState, NODE_STATE_NAME } from './types.js';
import { StateManager } from '../StateManager.js';

export class NodeStateManager extends StateManager<NodeState, NodeStateData> {
  constructor() {
    super(NODE_STATE_NAME.NONE, {}, 'nodeStateChange');
  }
}
