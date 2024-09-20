import { getNodeStateManager } from './instance.js';
import { sharedObj } from './shared.js';
import { NodeState, NodeStateData } from './types.js';

export const dispatch = (
  newState: NodeState,
  data: NodeStateData[NodeState],
) => {
  const stateManager = getNodeStateManager();

  const sharedData = {
    ...sharedObj('node', 'market'),
    ...data, // Allow additional data to override sharedObj if needed
  };

  stateManager.updateState(newState, sharedData);
};
